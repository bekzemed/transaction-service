import { Injectable } from '@nestjs/common';
import type { TransactionLine } from '../../../generated/prisma/client';
import { RiskWorkerPool } from './risk-worker-pool';
import type { RiskResult } from './risk.types';

@Injectable()
export class RiskCalculationService {
  constructor(private readonly riskWorkerPool: RiskWorkerPool) {}

  /**
   * Calculates risk for every line in the batch on the worker pool. All
   * lines are submitted at once; the pool runs up to N in parallel and
   * queues the rest until a thread frees up.
   */
  async calculateRiskForBatch(lines: TransactionLine[]): Promise<RiskResult[]> {
    return Promise.all(
      lines.map((line) =>
        this.riskWorkerPool.run({
          transactionLineId: line.id,
          amount: Number(line.amount),
          currency: line.currency,
          timestampMs: line.timestamp.getTime(),
        }),
      ),
    );
  }
}
