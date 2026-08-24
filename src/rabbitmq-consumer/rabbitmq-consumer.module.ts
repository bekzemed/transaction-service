import { Global, Module } from '@nestjs/common';
import { RabbitmqConsumerService } from './rabbitmq-consumer.service';

@Global()
@Module({
  providers: [RabbitmqConsumerService],
  exports: [RabbitmqConsumerService],
})
export class RabbitmqConsumerModule {}
