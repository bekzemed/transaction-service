import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { RiskCalculationService } from './risk/risk-calculation.service';
import { RiskWorkerPool } from './risk/risk-worker-pool';
import { TransactionLineHandler } from './transaction-line.handler';
import { TransactionLinesRepository } from './transaction-lines.repository';
import { TransactionLinesService } from './transaction-lines.service';

@Module({
  imports: [JobsModule],
  providers: [
    TransactionLinesRepository,
    TransactionLinesService,
    TransactionLineHandler,
    RiskWorkerPool,
    RiskCalculationService,
  ],
  exports: [TransactionLinesService],
})
export class TransactionLinesModule {}
