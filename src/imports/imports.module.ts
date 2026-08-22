import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ImportsController } from './imports.controller';

@Module({
  imports: [JobsModule],
  controllers: [ImportsController],
})
export class ImportsModule {}
