import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ProcessorModule } from './processor.module';
import { FileStorageService } from './storage/file-storage.service';
import { getUploadsRetentionMs } from './storage/storage.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ProcessorModule);

  app.enableShutdownHooks();

  const logger = new Logger('Processor');
  const retentionMs = getUploadsRetentionMs();
  if (retentionMs !== null) {
    const removed = await app
      .get(FileStorageService)
      .removeStaleFiles(retentionMs);
    if (removed > 0) {
      logger.log(`Removed ${removed} stale upload file(s)`);
    }
  }

  logger.log('Transaction processor started');
}

void bootstrap();
