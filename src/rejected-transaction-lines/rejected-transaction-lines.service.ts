import { BadRequestException, Injectable } from '@nestjs/common';
import type { RejectedTransactionLineCreateManyInput } from 'generated/prisma/models';
import { limitRawValue } from '../transaction-lines/limit-raw-value';
import type { TransactionRejection } from '../transaction-lines/transaction-line.types';
import {
  DEFAULT_REJECTIONS_PAGE_LIMIT,
  MAX_REJECTIONS_PAGE_LIMIT,
} from './rejected-transaction-lines.constants';
import { RejectedTransactionLinesRepository } from './rejected-transaction-lines.repository';
import {
  decodeRejectionCursor,
  encodeRejectionCursor,
} from './rejection-cursor';

export interface RejectionPage {
  items: Array<{
    lineNumber: number;
    reason: string;
    message: string;
    rawValue: string;
  }>;
  nextCursor: string | null;
}

@Injectable()
export class RejectedTransactionLinesService {
  constructor(
    private readonly rejectedTransactionLinesRepository: RejectedTransactionLinesRepository,
  ) {}

  async createMany(
    jobId: string,
    rejections: TransactionRejection[],
  ): Promise<void> {
    if (rejections.length === 0) {
      return;
    }

    const data: RejectedTransactionLineCreateManyInput[] = rejections.map(
      (rejection) => ({
        jobId,
        lineNumber: rejection.lineNumber,
        reason: rejection.reason,
        message: rejection.message,
        rawValue: limitRawValue(rejection.rawValue),
      }),
    );

    await this.rejectedTransactionLinesRepository.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findPage(
    jobId: string,
    limit?: string,
    cursor?: string,
  ): Promise<RejectionPage> {
    const take = parseLimit(limit);
    const skip = parseCursor(cursor);

    const rows = await this.rejectedTransactionLinesRepository.findPage(
      jobId,
      skip,
      take + 1,
    );

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? encodeRejectionCursor(skip + items.length) : null,
    };
  }
}

function parseLimit(limit?: string): number {
  if (limit == null || limit.trim() === '') {
    return DEFAULT_REJECTIONS_PAGE_LIMIT;
  }

  const value = Number(limit);
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestException('limit must be a positive integer');
  }
  if (value > MAX_REJECTIONS_PAGE_LIMIT) {
    throw new BadRequestException(
      `limit must be at most ${MAX_REJECTIONS_PAGE_LIMIT}`,
    );
  }

  return value;
}

function parseCursor(cursor?: string): number {
  if (cursor == null || cursor.trim() === '') {
    return 0;
  }

  return decodeRejectionCursor(cursor.trim());
}
