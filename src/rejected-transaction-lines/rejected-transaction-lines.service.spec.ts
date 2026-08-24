jest.mock('./rejected-transaction-lines.repository', () => ({
  RejectedTransactionLinesRepository: jest.fn().mockImplementation(() => ({})),
}));

import { BadRequestException } from '@nestjs/common';
import { RejectedTransactionLinesRepository } from './rejected-transaction-lines.repository';
import { RejectedTransactionLinesService } from './rejected-transaction-lines.service';
import { encodeRejectionCursor } from './rejection-cursor';

describe('RejectedTransactionLinesService', () => {
  const repository = {
    createMany: jest.fn(),
    findPage: jest.fn(),
  };
  const service = new RejectedTransactionLinesService(
    repository as unknown as RejectedTransactionLinesRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not write when there are no rejections', async () => {
    await service.createMany('job-1', []);

    expect(repository.createMany).not.toHaveBeenCalled();
  });

  it('persists rejections for a job', async () => {
    repository.createMany.mockResolvedValue({ count: 1 });

    await service.createMany('job-1', [
      {
        lineNumber: 125,
        reason: 'INVALID_CURRENCY',
        message: 'Currency must be a supported three-letter code',
        rawValue: '{"transactionId":"txn-100"}',
      },
    ]);

    expect(repository.createMany).toHaveBeenCalledWith({
      data: [
        {
          jobId: 'job-1',
          lineNumber: 125,
          reason: 'INVALID_CURRENCY',
          message: 'Currency must be a supported three-letter code',
          rawValue: '{"transactionId":"txn-100"}',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('defaults limit to 50 and omits nextCursor on a short page', async () => {
    repository.findPage.mockResolvedValue([
      {
        lineNumber: 125,
        reason: 'INVALID_CURRENCY',
        message: 'Currency must be a supported three-letter code',
        rawValue: '{"transactionId":"txn-100"}',
      },
    ]);

    const page = await service.findPage('job-1');

    expect(repository.findPage).toHaveBeenCalledWith('job-1', 0, 51);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
  });

  it('returns a next cursor when the page is full', async () => {
    repository.findPage.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        lineNumber: index + 1,
        reason: 'INVALID_JSON',
        message: 'Line is not valid JSON',
        rawValue: '',
      })),
    );

    const page = await service.findPage('job-1', '2');

    expect(repository.findPage).toHaveBeenCalledWith('job-1', 0, 3);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(encodeRejectionCursor(2));
  });

  it('skips rows using the decoded cursor offset', async () => {
    repository.findPage.mockResolvedValue([]);

    await service.findPage('job-1', '50', encodeRejectionCursor(50));

    expect(repository.findPage).toHaveBeenCalledWith('job-1', 50, 51);
  });

  it('rejects a limit above 500', async () => {
    await expect(service.findPage('job-1', '501')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
