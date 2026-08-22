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
}
