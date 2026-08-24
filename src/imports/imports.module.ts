import { Module } from '@nestjs/common';
import { CancellationRequestsModule } from '../cancellation-requests/cancellation-requests.module';
import { JobsModule } from '../jobs/jobs.module';
import { RejectedTransactionLinesModule } from '../rejected-transaction-lines/rejected-transaction-lines.module';
import { TransactionLinesRepository } from '../transaction-lines/transaction-lines.repository';
import { CleanupUploadedFileInterceptor } from './interceptors/cleanup-uploaded-file.interceptor';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    JobsModule,
    CancellationRequestsModule,
    RejectedTransactionLinesModule,
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    TransactionLinesRepository,
    CleanupUploadedFileInterceptor,
  ],
})
export class ImportsModule {}
