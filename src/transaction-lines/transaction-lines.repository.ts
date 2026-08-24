import { Injectable } from '@nestjs/common';
import type { Prisma, TransactionLine } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionLinesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createManyAndReturn(
    args: Prisma.TransactionLineCreateManyAndReturnArgs,
  ): Promise<TransactionLine[]> {
    return this.prisma.transactionLine.createManyAndReturn({
      ...args,
    });
  }

  /** Stable ordering so skip/limit pagination is deterministic. */
  findBatch(
    jobId: string,
    skip: number,
    take: number,
  ): Promise<TransactionLine[]> {
    return this.prisma.transactionLine.findMany({
      where: { jobId },
      skip,
      take,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async updateRisks(
    risks: { transactionLineId: string; risk: number }[],
  ): Promise<void> {
    if (risks.length === 0) {
      return;
    }
    await this.prisma.$transaction(
      risks.map(({ transactionLineId, risk }) =>
        this.prisma.transactionLine.update({
          where: { id: transactionLineId },
          data: { risk },
        }),
      ),
    );
  }

  async groupBy<K extends Prisma.TransactionLineScalarFieldEnum>(
    importId: string,
    by: K,
  ) {
    return this.prisma.transactionLine.groupBy({
      by: [by],
      where: { jobId: importId },
      _count: { _all: true },
      _sum: { amount: true },
    });
  }

  async count(where: Prisma.TransactionLineWhereInput): Promise<number> {
    return this.prisma.transactionLine.count({ where });
  }
}
