import { Injectable } from '@nestjs/common';
import type { CancellationRequest } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancellationRequestCreateInput } from 'generated/prisma/models';

@Injectable()
export class CancellationRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByJobId(jobId: string): Promise<CancellationRequest | null> {
    return this.prisma.cancellationRequest.findUnique({ where: { jobId } });
  }

  async create(
    data: CancellationRequestCreateInput,
  ): Promise<CancellationRequest> {
    return this.prisma.cancellationRequest.create({ data });
  }
}
