import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { ImportsModule } from './imports/imports.module';

@Module({
  imports: [PrismaModule, JobsModule, ImportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
