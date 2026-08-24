import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  RejectedTransactionLine,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RejectedTransactionLinesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(
    args: Prisma.RejectedTransactionLineCreateManyArgs,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.rejectedTransactionLine.createMany(args);
  }

  findPage(
    jobId: string,
    skip: number,
    take: number,
  ): Promise<
    Pick<
      RejectedTransactionLine,
      'lineNumber' | 'reason' | 'message' | 'rawValue'
    >[]
  > {
    return this.prisma.rejectedTransactionLine.findMany({
      where: { jobId },
      skip,
      take,
      orderBy: [{ lineNumber: 'asc' }, { id: 'asc' }],
      select: {
        lineNumber: true,
        reason: true,
        message: true,
        rawValue: true,
      },
    });
  }
}
