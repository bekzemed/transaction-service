import { Injectable } from '@nestjs/common';
import type { CancellationRequest } from '../../generated/prisma/client';
import { CancellationRequestsRepository } from './cancellation-requests.repository';

@Injectable()
export class CancellationRequestsService {
  constructor(
    private readonly cancellationRequestsRepository: CancellationRequestsRepository,
  ) {}

  async findByJobId(jobId: string): Promise<CancellationRequest | null> {
    return this.cancellationRequestsRepository.findByJobId(jobId);
  }

  async createCancellationRequest(
    jobId: string,
    reason?: string | null,
  ): Promise<CancellationRequest> {
    const existing =
      await this.cancellationRequestsRepository.findByJobId(jobId);

    if (existing) {
      return existing;
    }

    return this.cancellationRequestsRepository.create({
      job: { connect: { id: jobId } },
      reason: reason ?? null,
    });
  }
}
