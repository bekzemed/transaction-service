import {
  RABBITMQ_IMPORT_EXCHANGE,
  RABBITMQ_PROCESS_TRANSACTION_ROUTING_KEY,
  RABBITMQ_TRANSACTION_QUEUE,
} from './rabbitmq.constants';

export interface RabbitmqConfig {
  url: string;
  importExchange: string;
  transactionQueue: string;
  processTransactionRoutingKey: string;
  prefetch: number;
}

const DEFAULT_PREFETCH = 1;

export function getRabbitmqConfig(): RabbitmqConfig {
  const prefetch = Number(process.env.RABBITMQ_PREFETCH);

  return {
    url: process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:rabbitmq@localhost:5672',
    importExchange:
      process.env.RABBITMQ_IMPORT_EXCHANGE ?? RABBITMQ_IMPORT_EXCHANGE,
    transactionQueue:
      process.env.RABBITMQ_TRANSACTION_QUEUE ?? RABBITMQ_TRANSACTION_QUEUE,
    processTransactionRoutingKey:
      process.env.RABBITMQ_PROCESS_TRANSACTION_ROUTING_KEY ??
      RABBITMQ_PROCESS_TRANSACTION_ROUTING_KEY,
    prefetch:
      Number.isInteger(prefetch) && prefetch > 0 ? prefetch : DEFAULT_PREFETCH,
  };
}
