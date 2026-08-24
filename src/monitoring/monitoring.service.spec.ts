import { Logger } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('MonitoringService', () => {
  const originalInterval = process.env.MONITORING_INTERVAL_MS;

  beforeEach(() => {
    process.env.MONITORING_INTERVAL_MS = '40';
  });

  afterEach(() => {
    if (originalInterval === undefined) {
      delete process.env.MONITORING_INTERVAL_MS;
    } else {
      process.env.MONITORING_INTERVAL_MS = originalInterval;
    }
  });

  it('logs a snapshot on the sampling interval and stops after destroy', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new MonitoringService();

    service.onApplicationBootstrap();
    await wait(70);

    const snapshotLogs = logSpy.mock.calls
      .map(([message]) => message)
      .filter(
        (message): message is string =>
          typeof message === 'string' && message.includes('eventLoopDelayMs'),
      );

    expect(snapshotLogs.length).toBeGreaterThanOrEqual(1);
    expect(snapshotLogs[0]).toContain('eventLoopUtilization=');
    expect(snapshotLogs[0]).toContain('cpuPercent=');
    expect(snapshotLogs[0]).toContain('heapUsedBytes=');
    expect(snapshotLogs[0]).toContain('rssBytes=');

    service.onModuleDestroy();
    logSpy.mockClear();
    await wait(70);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
