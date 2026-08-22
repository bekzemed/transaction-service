import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Job } from '../../generated/prisma/client';
import type { JobUpdateInput } from 'generated/prisma/models';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
  constructor(private readonly jobsRepository: JobsRepository) {}

  async createImportJob(idempotencyKey: string): Promise<{
    job: Job;
    created: boolean;
  }> {
    const result = await this.jobsRepository.queryRaw(idempotencyKey);

    if (result.length > 0) {
      return { job: result[0], created: true };
    }

    const existing =
      await this.jobsRepository.findByIdempotencyKey(idempotencyKey);

    if (!existing) {
      throw new InternalServerErrorException('Failed to create import job');
    }

    return { job: existing, created: false };
  }

  update(jobId: string, data: JobUpdateInput): Promise<Job> {
    return this.jobsRepository.update(jobId, data);
  }

  findImportJobById(id: string): Promise<Job | null> {
    return this.jobsRepository.findById(id);
  }

  findAllImportJobs(): Promise<Job[]> {
    return this.jobsRepository.findAll();
  }
}
