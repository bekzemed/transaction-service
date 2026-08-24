import type { Logger } from '@nestjs/common';
import { connect, type AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { RabbitmqConfig } from './rabbitmq.config';

export function createRabbitmqConnection(
  url: string,
  logger: Logger,
): AmqpConnectionManager {
  const connection = connect([url]);

  connection.on('connect', () => {
    logger.log('Connected to RabbitMQ');
  });

  connection.on('disconnect', ({ err }) => {
    logger.warn(`Disconnected from RabbitMQ${err ? `: ${err.message}` : ''}`);
  });

  return connection;
}

/**
 * Asserted by both roles. The publisher needs the binding to exist too,
 * otherwise a topic exchange silently drops messages published before the
 * processor has started for the first time.
 */
export async function assertImportTopology(
  channel: ConfirmChannel,
  config: RabbitmqConfig,
): Promise<void> {
  await channel.assertExchange(config.importExchange, 'topic', {
    durable: true,
  });
  await channel.assertQueue(config.transactionQueue, { durable: true });
  await channel.bindQueue(
    config.transactionQueue,
    config.importExchange,
    config.processTransactionRoutingKey,
  );
}
