import type { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CancellationRequest } from '../../generated/prisma/client';
import { CancellationRequestsService } from '../cancellation-requests/cancellation-requests.service';
import { JobsService } from '../jobs/jobs.service';
import {
  type ProcessTransactionJobHandler,
  RabbitmqConsumerService,
} from '../rabbitmq-consumer/rabbitmq-consumer.service';
import { RejectedTransactionLinesService } from '../rejected-transaction-lines/rejected-transaction-lines.service';
import { FileStorageService } from '../storage/file-storage.service';
import { RiskCalculationService } from './risk/risk-calculation.service';
import { TransactionLineHandler } from './transaction-line.handler';
import { TransactionLinesRepository } from './transaction-lines.repository';
import { TransactionLinesService } from './transaction-lines.service';

const STORAGE_KEY = 'file.ndjson';
const JOB_ID = 'job-1';

const cancellationRequest: CancellationRequest = {
  id: 'cr-1',
  jobId: JOB_ID,
  reason: 'user requested',
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
};

function txLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    transactionId: 'txn-10001',
    accountId: 'acc-201',
    merchantId: 'merchant-18',
    amount: 145.75,
    currency: 'USD',
    timestamp: '2026-07-20T10:25:00.000Z',
    description: 'Subscription payment',
    ...overrides,
  });
}

const ENV_KEYS = [
  'IMPORT_BATCH_SIZE',
  'IMPORT_MAX_LINE_BYTES',
  'RISK_BATCH_SIZE',
] as const;

async function createHandler(
  env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {},
) {
  const previousEnv: Partial<
    Record<(typeof ENV_KEYS)[number], string | undefined>
  > = {};
  for (const key of ENV_KEYS) {
    previousEnv[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  let processJob: ProcessTransactionJobHandler | undefined;
  const rabbitmqConsumer = {
    registerProcessTransactionJobHandler: (
      handler: ProcessTransactionJobHandler,
    ) => {
      processJob = handler;
    },
  };
  const fileStorage = {
    createReadStream: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const repository = {
    createManyAndReturn: jest.fn(({ data }: { data: unknown[] }) =>
      Promise.resolve(data),
    ),
    findBatch: jest.fn().mockResolvedValue([]),
    updateRisks: jest.fn().mockResolvedValue(undefined),
  };
  const jobsService = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const riskCalculationService = {
    calculateRiskForBatch: jest.fn().mockResolvedValue([]),
  };
  const cancellationRequestsService = {
    findByJobId: jest.fn().mockResolvedValue(null),
  };
  const rejectedTransactionLinesService = {
    createMany: jest.fn().mockResolvedValue(undefined),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TransactionLineHandler,
      TransactionLinesService,
      { provide: TransactionLinesRepository, useValue: repository },
      { provide: RabbitmqConsumerService, useValue: rabbitmqConsumer },
      { provide: FileStorageService, useValue: fileStorage },
      { provide: JobsService, useValue: jobsService },
      { provide: RiskCalculationService, useValue: riskCalculationService },
      {
        provide: CancellationRequestsService,
        useValue: cancellationRequestsService,
      },
      {
        provide: RejectedTransactionLinesService,
        useValue: rejectedTransactionLinesService,
      },
    ],
  }).compile();

  await module.init();

  return {
    module,
    handler: module.get(TransactionLineHandler),
    processJob: processJob!,
    fileStorage,
    repository,
    jobsService,
    riskCalculationService,
    cancellationRequestsService,
    restoreEnv() {
      for (const key of ENV_KEYS) {
        const value = previousEnv[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

function ndjsonStream(lines: string[]): ReadStream {
  return Readable.from(lines.map((line) => `${line}\n`)) as ReadStream;
}

function updateCompletedAt(
  jobsService: { update: jest.Mock },
  callIndex: number,
): unknown {
  const calls = jobsService.update.mock.calls as unknown[][];
  const payload: unknown = calls[callIndex]?.[1];
  if (payload === null || typeof payload !== 'object') {
    return undefined;
  }
  return (payload as { completedAt?: unknown }).completedAt;
}

describe('TransactionLineHandler.parseTransactions', () => {
  let ctx: Awaited<ReturnType<typeof createHandler>>;

  beforeEach(async () => {
    ctx = await createHandler();
  });

  afterEach(async () => {
    await ctx.module.close();
    ctx.restoreEnv();
  });

  it('accepts a valid line and rejects empty, invalid, and invalid-amount lines', () => {
    const { passed, rejected } = ctx.handler.parseTransactions(
      [
        { lineNumber: 1, content: txLine() },
        { lineNumber: 2, content: '   ' },
        { lineNumber: 3, content: '{not json' },
        { lineNumber: 4, content: txLine({ amount: 0 }) },
      ],
      JOB_ID,
    );

    expect(passed).toHaveLength(1);
    expect(passed[0]?.transactionId).toBe('txn-10001');
    expect(rejected.map((row) => row.reason)).toEqual([
      'INVALID_JSON',
      'INVALID_JSON',
      'INVALID_AMOUNT',
    ]);
  });

  it('rejects a line that exceeds the configured byte limit before parsing', async () => {
    await ctx.module.close();
    ctx.restoreEnv();
    ctx = await createHandler({ IMPORT_MAX_LINE_BYTES: '16' });

    const { passed, rejected } = ctx.handler.parseTransactions(
      [{ lineNumber: 1, content: 'x'.repeat(17) }],
      JOB_ID,
    );

    expect(passed).toEqual([]);
    expect(rejected).toEqual([
      expect.objectContaining({
        lineNumber: 1,
        reason: 'LINE_TOO_LONG',
      }),
    ]);
  });
});

describe('TransactionLineHandler status transitions', () => {
  let ctx: Awaited<ReturnType<typeof createHandler>>;

  beforeEach(async () => {
    ctx = await createHandler({ IMPORT_BATCH_SIZE: '2', RISK_BATCH_SIZE: '1' });
  });

  afterEach(async () => {
    await ctx.module.close();
    ctx.restoreEnv();
  });

  it('marks the job completed after validation and risk scoring', async () => {
    ctx.fileStorage.createReadStream.mockReturnValue(ndjsonStream([txLine()]));

    await ctx.processJob({ jobId: JOB_ID, storageKey: STORAGE_KEY });

    expect(ctx.jobsService.update).toHaveBeenNthCalledWith(1, JOB_ID, {
      processed: 1,
      accepted: 1,
      rejected: 0,
      duplicates: 0,
    });
    expect(ctx.jobsService.update).toHaveBeenNthCalledWith(
      2,
      JOB_ID,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(updateCompletedAt(ctx.jobsService, 1)).toBeInstanceOf(Date);
    expect(ctx.fileStorage.remove).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('marks the job cancelled before validating when a request already exists', async () => {
    ctx.cancellationRequestsService.findByJobId.mockResolvedValue(
      cancellationRequest,
    );
    ctx.fileStorage.createReadStream.mockReturnValue(ndjsonStream([txLine()]));

    await ctx.processJob({ jobId: JOB_ID, storageKey: STORAGE_KEY });

    expect(ctx.repository.createManyAndReturn).not.toHaveBeenCalled();
    expect(
      ctx.riskCalculationService.calculateRiskForBatch,
    ).not.toHaveBeenCalled();
    expect(ctx.jobsService.update).toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({
        processed: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        status: 'cancelled',
      }),
    );
    expect(updateCompletedAt(ctx.jobsService, 0)).toBeInstanceOf(Date);
    expect(ctx.jobsService.update).not.toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(ctx.fileStorage.remove).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('stops validation at the next batch boundary after cancellation is requested', async () => {
    ctx.cancellationRequestsService.findByJobId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cancellationRequest);
    ctx.fileStorage.createReadStream.mockReturnValue(
      ndjsonStream([
        txLine({ transactionId: 'txn-1' }),
        txLine({ transactionId: 'txn-2' }),
        txLine({ transactionId: 'txn-3' }),
      ]),
    );

    await ctx.processJob({ jobId: JOB_ID, storageKey: STORAGE_KEY });

    expect(ctx.repository.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(ctx.jobsService.update).toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({
        processed: 2,
        accepted: 2,
        status: 'cancelled',
      }),
    );
    expect(
      ctx.riskCalculationService.calculateRiskForBatch,
    ).not.toHaveBeenCalled();
  });

  it('cancels during risk scoring and does not mark the job completed', async () => {
    ctx.cancellationRequestsService.findByJobId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cancellationRequest);
    ctx.fileStorage.createReadStream.mockReturnValue(ndjsonStream([txLine()]));

    await ctx.processJob({ jobId: JOB_ID, storageKey: STORAGE_KEY });

    expect(ctx.repository.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(ctx.jobsService.update).toHaveBeenNthCalledWith(1, JOB_ID, {
      processed: 1,
      accepted: 1,
      rejected: 0,
      duplicates: 0,
    });
    expect(ctx.jobsService.update).toHaveBeenNthCalledWith(
      2,
      JOB_ID,
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(updateCompletedAt(ctx.jobsService, 1)).toBeInstanceOf(Date);
    expect(
      ctx.riskCalculationService.calculateRiskForBatch,
    ).not.toHaveBeenCalled();
    expect(ctx.jobsService.update).not.toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({ status: 'completed' }),
    );
  });
});
