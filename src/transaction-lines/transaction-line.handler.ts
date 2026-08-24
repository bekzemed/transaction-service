import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createInterface } from 'node:readline';
import { CancellationRequestsService } from '../cancellation-requests/cancellation-requests.service';
import { JobsService } from '../jobs/jobs.service';
import { sanitizeForLog } from '../logging/sanitize-for-log';
import { RabbitmqConsumerService } from '../rabbitmq-consumer/rabbitmq-consumer.service';
import type { ProcessTransactionJobMessage } from '../rabbitmq/rabbitmq.messages';
import { RejectedTransactionLinesService } from '../rejected-transaction-lines/rejected-transaction-lines.service';
import { FileStorageService } from '../storage/file-storage.service';
import { RiskCalculationService } from './risk/risk-calculation.service';
import { DEFAULT_MAX_LINE_BYTES } from './transaction-line.constants';
import { limitRawValue } from './limit-raw-value';
import type {
  BatchValidationResult,
  JobProgressCounts,
  NormalizedTransaction,
  ParseTransactionsResult,
  TransactionRejection,
} from './transaction-line.types';
import { TransactionLinesService } from './transaction-lines.service';

interface FileLine {
  lineNumber: number;
  content: string;
}

@Injectable()
export class TransactionLineHandler implements OnModuleInit {
  private readonly logger = new Logger(TransactionLineHandler.name);
  private readonly batchSize = getImportBatchSize();
  private readonly maxLineBytes = getMaxLineBytes();
  private readonly riskBatchSize = getRiskBatchSize();

  constructor(
    private readonly rabbitmqConsumer: RabbitmqConsumerService,
    private readonly fileStorage: FileStorageService,
    private readonly transactionLinesService: TransactionLinesService,
    private readonly jobsService: JobsService,
    private readonly riskCalculationService: RiskCalculationService,
    private readonly cancellationRequestsService: CancellationRequestsService,
    private readonly rejectedTransactionLinesService: RejectedTransactionLinesService,
  ) {}

  onModuleInit(): void {
    this.rabbitmqConsumer.registerProcessTransactionJobHandler(
      async (message) => await this.handle(message),
    );
    this.logger.log('Registered PROCESS_TRANSACTION_JOB handler');
  }

  private async handle(message: ProcessTransactionJobMessage): Promise<void> {
    try {
      await this.processJob(message);
    } finally {
      await this.removeUpload(message.storageKey);
    }
  }

  private async processJob(
    message: ProcessTransactionJobMessage,
  ): Promise<void> {
    this.logger.log(
      `Received PROCESS_TRANSACTION_JOB for job ${sanitizeForLog(message.jobId)}`,
    );

    const counts: JobProgressCounts = {
      processed: 0,
      accepted: 0,
      rejected: 0,
      duplicates: 0,
    };

    const stream = this.fileStorage.createReadStream(message.storageKey);
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    const batch: FileLine[] = [];
    let lineNumber = 0;

    try {
      for await (const content of lines) {
        lineNumber += 1;
        batch.push({ lineNumber, content });

        if (batch.length >= this.batchSize) {
          if (await this.cancelJobIfRequested(message.jobId, counts)) {
            return;
          }

          const result = await this.processBatchValidation(
            batch,
            message.jobId,
          );
          counts.processed += batch.length;
          counts.rejected += result.rejected.length;
          counts.accepted += result.inserted.length;
          counts.duplicates += result.duplicateCount;
          batch.length = 0;
        }
      }

      if (batch.length > 0) {
        if (await this.cancelJobIfRequested(message.jobId, counts)) {
          return;
        }

        const result = await this.processBatchValidation(batch, message.jobId);
        counts.processed += batch.length;
        counts.rejected += result.rejected.length;
        counts.accepted += result.inserted.length;
        counts.duplicates += result.duplicateCount;
      }
    } finally {
      lines.close();
      stream.destroy();
    }

    await this.jobsService.update(message.jobId, counts);

    this.logger.log(
      `Job ${sanitizeForLog(message.jobId)} validation/persist complete: ` +
        `processed=${counts.processed} accepted=${counts.accepted} ` +
        `rejected=${counts.rejected} duplicates=${counts.duplicates}`,
    );

    const cancelledDuringRisk = await this.calculateTransactionRisk(
      message.jobId,
    );
    if (cancelledDuringRisk) {
      return;
    }

    await this.jobsService.update(message.jobId, {
      status: 'completed',
      completedAt: new Date(),
    });

    this.logger.log(`Job ${sanitizeForLog(message.jobId)} marked completed`);
  }

  /**
   * Pages through transaction lines with skip/limit and scores each batch on
   * the worker pool. Risk scores are persisted per batch before the next
   * batch is fetched. Returns true when the job was cancelled mid-scoring.
   */
  private async calculateTransactionRisk(jobId: string): Promise<boolean> {
    let skip = 0;
    let scored = 0;

    for (;;) {
      if (await this.cancelJobIfRequested(jobId)) {
        return true;
      }

      const lines = await this.transactionLinesService.findBatch(
        jobId,
        skip,
        this.riskBatchSize,
      );
      if (lines.length === 0) {
        break;
      }

      const risks =
        await this.riskCalculationService.calculateRiskForBatch(lines);
      await this.transactionLinesService.updateRisks(risks);

      scored += risks.length;
      this.logger.log(
        `Job ${sanitizeForLog(jobId)} risk calculation progress: scored=${scored}`,
      );

      if (lines.length < this.riskBatchSize) {
        break;
      }
      skip += lines.length;
    }

    this.logger.log(
      `Job ${sanitizeForLog(jobId)} risk calculation complete: scored=${scored}`,
    );
    return false;
  }

  /**
   * If a cancellation request exists for this job, persist terminal cancelled
   * status (and any validation counts so far) and return true so the handler
   * can exit without throwing — the queue message must be acked.
   */
  private async cancelJobIfRequested(
    jobId: string,
    counts?: JobProgressCounts,
  ): Promise<boolean> {
    const cancellationRequest =
      await this.cancellationRequestsService.findByJobId(jobId);

    if (!cancellationRequest) {
      return false;
    }

    await this.jobsService.update(jobId, {
      ...(counts ?? {}),
      status: 'cancelled',
      completedAt: new Date(),
    });

    this.logger.log(`Job ${sanitizeForLog(jobId)} cancelled`);
    return true;
  }

  private async removeUpload(storageKey: string): Promise<void> {
    try {
      await this.fileStorage.remove(storageKey);
    } catch (error) {
      this.logger.warn(
        `Failed to remove upload ${sanitizeForLog(storageKey)}: ${sanitizeForLog(error)}`,
      );
    }
  }

  /**
   * Validates the batch, persists accepted and rejected rows, and returns
   * outcomes so the handler can update counts and drive later pipeline stages.
   */
  private async processBatchValidation(
    batch: FileLine[],
    jobId: string,
  ): Promise<BatchValidationResult> {
    const { passed, rejected } = this.parseTransactions(batch, jobId);

    const inserted = await this.transactionLinesService.createManyAndReturn(
      passed,
      { skipDuplicates: true },
    );
    await this.rejectedTransactionLinesService.createMany(jobId, rejected);

    return {
      rejected,
      inserted,
      duplicateCount: passed.length - inserted.length,
    };
  }

  /**
   * Validates each line in the batch. Empty lines are counted as processed
   * but rejected so progress stays aligned with file line numbers.
   */
  parseTransactions(batch: FileLine[], jobId: string): ParseTransactionsResult {
    const passed: NormalizedTransaction[] = [];
    const rejected: TransactionRejection[] = [];

    for (const { lineNumber, content } of batch) {
      if (content.trim().length === 0) {
        rejected.push({
          lineNumber,
          reason: 'INVALID_JSON',
          message: 'Empty line',
          rawValue: '',
        });
        continue;
      }

      if (Buffer.byteLength(content, 'utf8') > this.maxLineBytes) {
        rejected.push({
          lineNumber,
          reason: 'LINE_TOO_LONG',
          message: `Line exceeds maximum length of ${this.maxLineBytes} bytes`,
          rawValue: limitRawValue(content),
        });
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content) as unknown;
      } catch {
        rejected.push({
          lineNumber,
          reason: 'INVALID_JSON',
          message: 'Line is not valid JSON',
          rawValue: limitRawValue(content),
        });
        continue;
      }

      const result = this.transactionLinesService.validate(parsed, jobId);
      if (result.ok) {
        passed.push(result.value);
      } else {
        rejected.push({
          lineNumber,
          reason: result.reason,
          message: result.message,
          rawValue: limitRawValue(content),
        });
      }
    }

    return { passed, rejected };
  }
}

function getImportBatchSize(): number {
  const value = Number(process.env.IMPORT_BATCH_SIZE);
  return Number.isInteger(value) && value > 0 ? value : 100;
}

function getMaxLineBytes(): number {
  const value = Number(process.env.IMPORT_MAX_LINE_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_LINE_BYTES;
}

function getRiskBatchSize(): number {
  const value = Number(process.env.RISK_BATCH_SIZE);
  return Number.isInteger(value) && value > 0 ? value : 100;
}
