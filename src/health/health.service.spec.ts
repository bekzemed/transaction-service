import type { HttpAdapterHost } from '@nestjs/core';
import { HealthService } from './health.service';

function createService(listening: boolean): HealthService {
  const httpAdapterHost = {
    httpAdapter: {
      getHttpServer: () => ({ listening }),
    },
  } as unknown as HttpAdapterHost;

  return new HealthService(httpAdapterHost);
}

describe('HealthService', () => {
  it('reports live even when the HTTP server is not ready', () => {
    const service = createService(false);

    expect(service.live()).toEqual({ status: 'ok' });
    expect(service.ready()).toEqual({ status: 'error', server: 'down' });
  });

  it('reports ready after bootstrap while the HTTP server is listening', () => {
    const service = createService(true);
    service.onApplicationBootstrap();

    expect(service.ready()).toEqual({ status: 'ok', server: 'up' });
  });

  it('reports not ready while shutting down', () => {
    const service = createService(true);
    service.onApplicationBootstrap();
    service.beforeApplicationShutdown();

    expect(service.live()).toEqual({ status: 'ok' });
    expect(service.ready()).toEqual({ status: 'error', server: 'down' });
  });
});
