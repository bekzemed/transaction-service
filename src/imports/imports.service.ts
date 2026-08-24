import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CancellationRequest, Job } from '../../generated/prisma/client';
import { CancellationRequestsService } from '../cancellation-requests/cancellation-requests.service';
import { JobsService } from '../jobs/jobs.service';
import { RabbitmqPublisherService } from '../rabbitmq-publisher/rabbitmq-publisher.service';
import { TransactionLinesRepository } from '../transaction-lines/transaction-lines.repository';
import {
  ImportSummaryAccountRto,
  ImportSummaryCurrencyRto,
  ImportSummaryMerchantRto,
  ImportSummaryRiskLevelRto,
  ImportSummaryRto,
  ImportSummaryTotalsRto,
} from './rto/import-summary.rto';
import {
  RISK_LEVEL_LOW_MAX,
  RISK_LEVEL_MEDIUM_MAX,
} from 'src/transaction-lines/transaction-line.constants';

@Injectable()
export class ImportsService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly rabbitmqPublisher: RabbitmqPublisherService,
    private readonly transactionLinesRepository: TransactionLinesRepository,
    private readonly cancellationRequestsService: CancellationRequestsService,
  ) {}

  async createImport(idempotencyKey: string, storageKey: string): Promise<Job> {
    const { job, created } =
      await this.jobsService.createImportJob(idempotencyKey);

    if (created) {
      await this.rabbitmqPublisher.publishProcessTransactionJob({
        jobId: job.id,
        storageKey,
      });
    }

    return job;
  }

  async getImport(id: string): Promise<Job> {
    const job = await this.jobsService.findImportJobById(id);

    if (!job) {
      throw new NotFoundException(`Import job ${id} not found`);
    }

    return job;
  }

  async requestCancellation(
    id: string,
    reason?: string | null,
  ): Promise<CancellationRequest> {
    const job = await this.getImport(id);

    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new BadRequestException(
        `Import job ${id} cannot be cancelled because its status is ${job.status}`,
      );
    }

    const cancellationRequest =
      await this.cancellationRequestsService.createCancellationRequest(
        id,
        reason,
      );

    await this.jobsService.update(id, { status: 'cancelling' });

    return cancellationRequest;
  }

  async getImportSummary(id: string): Promise<ImportSummaryRto> {
    const job = await this.getImport(id);

    const [
      currencyResult,
      merchantResult,
      accountResult,
      lowResult,
      mediumResult,
      highResult,
    ] = await Promise.allSettled([
      this.transactionLinesRepository.groupBy(job.id, 'currency'),
      this.transactionLinesRepository.groupBy(job.id, 'merchantId'),
      this.transactionLinesRepository.groupBy(job.id, 'accountId'),
      this.transactionLinesRepository.count({
        jobId: job.id,
        risk: { gte: 1, lte: RISK_LEVEL_LOW_MAX },
      }),
      this.transactionLinesRepository.count({
        jobId: job.id,
        risk: {
          gte: RISK_LEVEL_LOW_MAX + 1,
          lte: RISK_LEVEL_MEDIUM_MAX,
        },
      }),
      this.transactionLinesRepository.count({
        jobId: job.id,
        risk: { gt: RISK_LEVEL_MEDIUM_MAX },
      }),
    ]);

    if (currencyResult.status === 'rejected') {
      throw currencyResult.reason;
    }

    if (merchantResult.status === 'rejected') {
      throw merchantResult.reason;
    }

    if (accountResult.status === 'rejected') {
      throw accountResult.reason;
    }

    if (lowResult.status === 'rejected') {
      throw lowResult.reason;
    }

    if (mediumResult.status === 'rejected') {
      throw mediumResult.reason;
    }

    if (highResult.status === 'rejected') {
      throw highResult.reason;
    }

    return ImportSummaryRto.from(
      job.id,
      ImportSummaryTotalsRto.fromJob(job),
      ImportSummaryCurrencyRto.fromRows(currencyResult.value),
      ImportSummaryRiskLevelRto.from(
        lowResult.value,
        mediumResult.value,
        highResult.value,
      ),
      ImportSummaryMerchantRto.fromRows(merchantResult.value),
      ImportSummaryAccountRto.fromRows(accountResult.value),
    );
  }
}
