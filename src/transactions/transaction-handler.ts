import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqConsumerService } from '../rabbitmq-consumer/rabbitmq-consumer.service';
import type { ProcessTransactionJobMessage } from '../rabbitmq/rabbitmq.messages';
import { FileStorageService } from '../storage/file-storage.service';

@Injectable()
export class TransactionHandler implements OnModuleInit {
  private readonly logger = new Logger(TransactionHandler.name);

  constructor(
    private readonly rabbitmqConsumer: RabbitmqConsumerService,
    private readonly fileStorage: FileStorageService,
  ) {}

  onModuleInit(): void {
    this.rabbitmqConsumer.registerProcessTransactionJobHandler(
      async (message) => await this.handle(message),
    );
    this.logger.log('Registered PROCESS_TRANSACTION_JOB handler');
  }

  private async handle(message: ProcessTransactionJobMessage): Promise<void> {
    this.logger.log(`Received PROCESS_TRANSACTION_JOB for job ${message.jobId}`);

    // Throws before any work starts if the key did not come from this service.
    this.fileStorage.resolvePath(message.storageKey);

    // Transaction processing pipeline will be implemented here.
    return Promise.resolve();
  }
}
