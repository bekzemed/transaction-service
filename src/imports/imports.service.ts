import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job } from '../../generated/prisma/client';
import { JobsService } from '../jobs/jobs.service';
import { RabbitmqPublisherService } from '../rabbitmq-publisher/rabbitmq-publisher.service';

@Injectable()
export class ImportsService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly rabbitmqPublisher: RabbitmqPublisherService,
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
}
