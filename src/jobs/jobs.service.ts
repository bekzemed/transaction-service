import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Job } from '../../generated/prisma/client';
import { JobsRepository } from './jobs.repository';
import { RabbitmqPublisherService } from '../rabbitmq-publisher/rabbitmq-publisher.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly rabbitmqPublisher: RabbitmqPublisherService,
  ) {}

  async createImportJob(
    idempotencyKey: string,
    storageKey: string,
  ): Promise<Job> {
    const result = await this.jobsRepository.queryRaw(idempotencyKey);

    if (result.length > 0) {
      await this.rabbitmqPublisher.publishProcessTransactionJob({
        jobId: result[0].id,
        storageKey,
      });

      return result[0];
    }

    const existing =
      await this.jobsRepository.findByIdempotencyKey(idempotencyKey);

    if (!existing) {
      throw new InternalServerErrorException('Failed to create import job');
    }

    return existing;
  }

  findImportJobById(id: string): Promise<Job | null> {
    return this.jobsRepository.findById(id);
  }

  findAllImportJobs(): Promise<Job[]> {
    return this.jobsRepository.findAll();
  }
}
