import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { sanitizeForLog } from '../logging/sanitize-for-log';
import { getRabbitmqConfig } from '../rabbitmq/rabbitmq.config';
import {
  assertImportTopology,
  createRabbitmqConnection,
} from '../rabbitmq/rabbitmq.connection';
import {
  isProcessTransactionJobMessage,
  type ProcessTransactionJobMessage,
} from '../rabbitmq/rabbitmq.messages';

export type ProcessTransactionJobHandler = (
  message: ProcessTransactionJobMessage,
) => Promise<void>;

/**
 * Consume side of the queue, used by the processor process only.
 *
 * Consumption starts in `onApplicationBootstrap`, after every module has run
 * `onModuleInit`, so a handler is guaranteed to be registered before the first
 * delivery arrives.
 */
@Injectable()
export class RabbitmqConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitmqConsumerService.name);
  private readonly config = getRabbitmqConfig();
  private connection: AmqpConnectionManager | null = null;
  private channel: ChannelWrapper | null = null;
  private handler: ProcessTransactionJobHandler | null = null;

  registerProcessTransactionJobHandler(
    handler: ProcessTransactionJobHandler,
  ): void {
    this.handler = handler;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.handler) {
      throw new Error(
        'No PROCESS_TRANSACTION_JOB handler was registered; refusing to consume',
      );
    }

    this.connection = createRabbitmqConnection(this.config.url, this.logger);

    this.channel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await assertImportTopology(channel, this.config);
        // Bounds how many jobs this process can have in flight at once.
        await channel.prefetch(this.config.prefetch);
        await channel.consume(
          this.config.transactionQueue,
          (message: ConsumeMessage | null) => {
            if (!message) {
              return;
            }

            void this.handleProcessTransactionMessage(channel, message);
          },
          { noAck: false },
        );
      },
    });

    await this.channel.waitForConnect();
    this.logger.log(
      `Consuming ${this.config.transactionQueue} (prefetch=${this.config.prefetch} consumerTimeoutMs=${this.config.consumerTimeoutMs})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handleProcessTransactionMessage(
    channel: ConfirmChannel,
    message: ConsumeMessage,
  ): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.content.toString()) as unknown;
    } catch {
      this.logger.error(
        'Rejected PROCESS_TRANSACTION_JOB: payload is not JSON',
      );
      channel.nack(message, false, false);
      return;
    }

    if (!isProcessTransactionJobMessage(parsed)) {
      this.logger.error(
        `Rejected PROCESS_TRANSACTION_JOB payload: ${sanitizeForLog(parsed)}`,
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.handler!(parsed);
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to process PROCESS_TRANSACTION_JOB for job ${sanitizeForLog(parsed.jobId)}`,
        error instanceof Error ? error.stack : sanitizeForLog(error),
      );
      channel.nack(message, false, false);
    }
  }
}
