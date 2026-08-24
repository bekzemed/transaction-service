import { Module } from '@nestjs/common';
import { CancellationRequestsRepository } from './cancellation-requests.repository';
import { CancellationRequestsService } from './cancellation-requests.service';

@Module({
  providers: [CancellationRequestsService, CancellationRequestsRepository],
  exports: [CancellationRequestsService],
})
export class CancellationRequestsModule {}
