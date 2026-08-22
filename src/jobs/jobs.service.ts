import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Job } from '../../generated/prisma/client';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
  constructor(private readonly jobsRepository: JobsRepository) {}

  async createImportJob(idempotencyKey: string): Promise<Job> {
    const result = await this.jobsRepository.queryRaw(idempotencyKey);

    if (result.length > 0) return result[0];

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
