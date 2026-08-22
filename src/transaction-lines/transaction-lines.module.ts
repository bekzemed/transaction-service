import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { TransactionLineHandler } from './transaction-line.handler';
import { TransactionLinesRepository } from './transaction-lines.repository';
import { TransactionLinesService } from './transaction-lines.service';

@Module({
  imports: [JobsModule],
  providers: [
    TransactionLinesRepository,
    TransactionLinesService,
    TransactionLineHandler,
  ],
  exports: [TransactionLinesService],
})
export class TransactionLinesModule {}
