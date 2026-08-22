import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [JobsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
