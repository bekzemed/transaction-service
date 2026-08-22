import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqConsumerModule } from './rabbitmq-consumer/rabbitmq-consumer.module';
import { StorageModule } from './storage/storage.module';
import { TransactionLinesModule } from './transaction-lines/transaction-lines.module';

/**
 * Root module of the processor process. It has no controllers: this process
 * only consumes jobs, so no request handling shares its event loop.
 */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    RabbitmqConsumerModule,
    TransactionLinesModule,
  ],
})
export class ProcessorModule {}
