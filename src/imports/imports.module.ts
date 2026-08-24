import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { TransactionLinesRepository } from '../transaction-lines/transaction-lines.repository';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [JobsModule],
  controllers: [ImportsController],
  providers: [ImportsService, TransactionLinesRepository],
})
export class ImportsModule {}
