import { Test } from '@nestjs/testing';
import type { TransactionLine } from '../../../generated/prisma/client';
import { RiskCalculationService } from './risk-calculation.service';
import { RiskWorkerPool } from './risk-worker-pool';

describe('RiskCalculationService', () => {
  it('submits every line to the worker pool and returns the scores in order', async () => {
    const riskWorkerPool = {
      run: jest
        .fn()
        .mockResolvedValueOnce({ transactionLineId: 'tl-1', risk: 9 })
        .mockResolvedValueOnce({ transactionLineId: 'tl-2', risk: 94 }),
    };
    const module = await Test.createTestingModule({
      providers: [
        RiskCalculationService,
        { provide: RiskWorkerPool, useValue: riskWorkerPool },
      ],
    }).compile();
    const service = module.get(RiskCalculationService);
    const timestamp = new Date('2026-07-20T10:25:00.000Z');

    const results = await service.calculateRiskForBatch([
      {
        id: 'tl-1',
        amount: 100,
        currency: 'USD',
        timestamp,
      } as unknown as TransactionLine,
      {
        id: 'tl-2',
        amount: 10_000,
        currency: 'ETB',
        timestamp,
      } as unknown as TransactionLine,
    ]);

    expect(riskWorkerPool.run).toHaveBeenNthCalledWith(1, {
      transactionLineId: 'tl-1',
      amount: 100,
      currency: 'USD',
      timestampMs: timestamp.getTime(),
    });
    expect(riskWorkerPool.run).toHaveBeenNthCalledWith(2, {
      transactionLineId: 'tl-2',
      amount: 10_000,
      currency: 'ETB',
      timestampMs: timestamp.getTime(),
    });
    expect(results).toEqual([
      { transactionLineId: 'tl-1', risk: 9 },
      { transactionLineId: 'tl-2', risk: 94 },
    ]);
  });
});
