import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { JobsModule } from './jobs/jobs.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqPublisherModule } from './rabbitmq-publisher/rabbitmq-publisher.module';
import { StorageModule } from './storage/storage.module';

/**
 * Root module of the API process. Transaction processing lives in
 * `ProcessorModule` so it never shares this process's event loop.
 */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    RabbitmqPublisherModule,
    JobsModule,
    ImportsModule,
    HealthModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
