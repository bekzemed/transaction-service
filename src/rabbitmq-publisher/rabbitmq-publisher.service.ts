import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { getRabbitmqConfig } from '../rabbitmq/rabbitmq.config';
import {
  assertImportTopology,
  createRabbitmqConnection,
} from '../rabbitmq/rabbitmq.connection';
import type { ProcessTransactionJobMessage } from '../rabbitmq/rabbitmq.messages';

/**
 * Publish side of the queue, used by the API process only. It never consumes,
 * so the API cannot pull jobs it has no handler for.
 */
@Injectable()
export class RabbitmqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqPublisherService.name);
  private readonly config = getRabbitmqConfig();
  private connection: AmqpConnectionManager | null = null;
  private channel: ChannelWrapper | null = null;

  async onModuleInit(): Promise<void> {
    this.connection = createRabbitmqConnection(this.config.url, this.logger);

    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: ConfirmChannel) =>
        assertImportTopology(channel, this.config),
    });

    await this.channel.waitForConnect();
    this.logger.log(
      `Publisher ready (exchange=${this.config.importExchange}, routingKey=${this.config.processTransactionRoutingKey})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publishProcessTransactionJob(
    message: ProcessTransactionJobMessage,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ publisher channel is not initialized');
    }

    await this.channel.publish(
      this.config.importExchange,
      this.config.processTransactionRoutingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
      },
    );
  }
}
