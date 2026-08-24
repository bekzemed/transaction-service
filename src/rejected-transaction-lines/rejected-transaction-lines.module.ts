import { Module } from '@nestjs/common';
import { RejectedTransactionLinesRepository } from './rejected-transaction-lines.repository';
import { RejectedTransactionLinesService } from './rejected-transaction-lines.service';

@Module({
  providers: [
    RejectedTransactionLinesService,
    RejectedTransactionLinesRepository,
  ],
  exports: [RejectedTransactionLinesService],
})
export class RejectedTransactionLinesModule {}
