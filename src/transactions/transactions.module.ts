import { Module } from '@nestjs/common';
import { TransactionHandler } from './transaction-handler';

@Module({
  providers: [TransactionHandler],
})
export class TransactionsModule {}
