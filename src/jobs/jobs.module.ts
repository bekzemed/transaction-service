import { Module } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  providers: [JobsService, JobsRepository],
  exports: [JobsService],
})
export class JobsModule {}
