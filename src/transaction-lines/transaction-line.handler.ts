import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createInterface } from 'node:readline';
import { JobsService } from '../jobs/jobs.service';
import { RabbitmqConsumerService } from '../rabbitmq-consumer/rabbitmq-consumer.service';
import type { ProcessTransactionJobMessage } from '../rabbitmq/rabbitmq.messages';
import { FileStorageService } from '../storage/file-storage.service';
import { RiskCalculationService } from './risk/risk-calculation.service';
import { DEFAULT_MAX_LINE_BYTES } from './transaction-line.constants';
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
  ) {}

  onModuleInit(): void {
    this.rabbitmqConsumer.registerProcessTransactionJobHandler(
      async (message) => await this.handle(message),
    );
    this.logger.log('Registered PROCESS_TRANSACTION_JOB handler');
  }

  private async handle(message: ProcessTransactionJobMessage): Promise<void> {
    this.logger.log(
      `Received PROCESS_TRANSACTION_JOB for job ${message.jobId}`,
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
      `Job ${message.jobId} validation/persist complete: ` +
        `processed=${counts.processed} accepted=${counts.accepted} ` +
        `rejected=${counts.rejected} duplicates=${counts.duplicates}`,
    );

    await this.calculateTransactionRisk(message.jobId);

    await this.jobsService.update(message.jobId, {
      status: 'completed',
      completedAt: new Date(),
    });

    this.logger.log(`Job ${message.jobId} marked completed`);
  }

  /**
   * Pages through transaction lines with skip/limit and scores each batch on
   * the worker pool. Risk scores are persisted per batch before the next
   * batch is fetched.
   */
  private async calculateTransactionRisk(jobId: string): Promise<void> {
    let skip = 0;
    let scored = 0;

    for (;;) {
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
        `Job ${jobId} risk calculation progress: scored=${scored}`,
      );

      if (lines.length < this.riskBatchSize) {
        break;
      }
      skip += lines.length;
    }

    this.logger.log(`Job ${jobId} risk calculation complete: scored=${scored}`);
  }

  /**
   * Validates the batch, persists rows that pass, and returns outcomes so the
   * handler can update counts and drive later pipeline stages.
   */
  private async processBatchValidation(
    batch: FileLine[],
    jobId: string,
  ): Promise<BatchValidationResult> {
    const { passed, rejected } = this.parseTransactions(batch, jobId);

    if (passed.length === 0) {
      return { rejected, inserted: [], duplicateCount: 0 };
    }

    const inserted = await this.transactionLinesService.createManyAndReturn(
      passed,
      { skipDuplicates: true },
    );

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
          rawValue: content.slice(0, 256),
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
          rawValue: content.slice(0, 256),
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
          rawValue: result.rawValue,
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
