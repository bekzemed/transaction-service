import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ProcessorModule } from './processor.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ProcessorModule);

  app.enableShutdownHooks();

  new Logger('Processor').log('Transaction processor started');
}

void bootstrap();
