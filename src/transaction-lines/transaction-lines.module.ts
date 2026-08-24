import { Module } from '@nestjs/common';
import { CancellationRequestsModule } from '../cancellation-requests/cancellation-requests.module';
import { JobsModule } from '../jobs/jobs.module';
import { RejectedTransactionLinesModule } from '../rejected-transaction-lines/rejected-transaction-lines.module';
import { RiskCalculationService } from './risk/risk-calculation.service';
import { RiskWorkerPool } from './risk/risk-worker-pool';
import { TransactionLineHandler } from './transaction-line.handler';
import { TransactionLinesRepository } from './transaction-lines.repository';
import { TransactionLinesService } from './transaction-lines.service';

@Module({
  imports: [
    JobsModule,
    CancellationRequestsModule,
    RejectedTransactionLinesModule,
  ],
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
