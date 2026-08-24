import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventLoopSampler } from './event-loop-sampler';

const DEFAULT_INTERVAL_MS = 10_000;

@Injectable()
export class MonitoringService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MonitoringService.name);
  private readonly sampler = new EventLoopSampler();
  private readonly intervalMs = getMonitoringIntervalMs();
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      this.logSnapshot();
    }, this.intervalMs);
    // Interval must not keep a shutting-down or idle process alive.
    this.timer.unref();
    this.logger.log(
      `Event-loop monitoring started (intervalMs=${this.intervalMs})`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.sampler.disable();
  }

  private logSnapshot(): void {
    const snapshot = this.sampler.sample();
    const delay = snapshot.eventLoopDelayMs;

    this.logger.log(
      `eventLoopDelayMs mean=${delay.mean} p50=${delay.p50} p99=${delay.p99} max=${delay.max} ` +
        `eventLoopUtilization=${snapshot.eventLoopUtilization} ` +
        `cpuPercent=${snapshot.cpuPercent} ` +
        `heapUsedBytes=${snapshot.heapUsedBytes} ` +
        `heapTotalBytes=${snapshot.heapTotalBytes} ` +
        `rssBytes=${snapshot.rssBytes}`,
    );
  }
}

function getMonitoringIntervalMs(): number {
  const value = Number(process.env.MONITORING_INTERVAL_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_INTERVAL_MS;
}
