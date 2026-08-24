import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { HealthLiveRto, HealthReadyRto } from './rto/health.rto';

@Injectable()
export class HealthService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private bootstrapped = false;
  private shuttingDown = false;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onApplicationBootstrap(): void {
    this.bootstrapped = true;
  }

  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  live(): HealthLiveRto {
    return new HealthLiveRto();
  }

  ready(): HealthReadyRto {
    return this.isServerReady() ? HealthReadyRto.ok() : HealthReadyRto.error();
  }

  private isServerReady(): boolean {
    const server = this.httpAdapterHost.httpAdapter?.getHttpServer() as
      { listening?: boolean } | undefined;

    return (
      this.bootstrapped && !this.shuttingDown && server?.listening === true
    );
  }
}
