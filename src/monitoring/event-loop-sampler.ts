import {
  monitorEventLoopDelay,
  performance,
  type EventLoopUtilization,
  type IntervalHistogram,
} from 'node:perf_hooks';

export interface EventLoopDelayMs {
  mean: number;
  p50: number;
  p99: number;
  max: number;
}

export interface EventLoopSnapshot {
  eventLoopDelayMs: EventLoopDelayMs;
  eventLoopUtilization: number;
  cpuPercent: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  rssBytes: number;
}

/**
 * Collects the five process-level event-loop health metrics from Node.js
 * built-ins. Call `sample()` on a timer; each call reports the window since
 * the previous sample (or since construction).
 */
export class EventLoopSampler {
  private readonly histogram: IntervalHistogram;
  private previousElu: EventLoopUtilization;
  private previousCpu: NodeJS.CpuUsage;
  private previousHrtimeNs: bigint;

  constructor() {
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();
    this.previousElu = performance.eventLoopUtilization();
    this.previousCpu = process.cpuUsage();
    this.previousHrtimeNs = process.hrtime.bigint();
  }

  sample(): EventLoopSnapshot {
    const nowHrtimeNs = process.hrtime.bigint();
    const cpuDelta = process.cpuUsage(this.previousCpu);
    const currentElu = performance.eventLoopUtilization();
    const eluDelta = performance.eventLoopUtilization(
      currentElu,
      this.previousElu,
    );
    const memory = process.memoryUsage();

    const snapshot: EventLoopSnapshot = {
      eventLoopDelayMs: {
        mean: nanosecondsToMilliseconds(this.histogram.mean),
        p50: nanosecondsToMilliseconds(this.histogram.percentile(50)),
        p99: nanosecondsToMilliseconds(this.histogram.percentile(99)),
        max: nanosecondsToMilliseconds(this.histogram.max),
      },
      eventLoopUtilization: roundTo(eluDelta.utilization, 3),
      cpuPercent: cpuPercent(cpuDelta, nowHrtimeNs - this.previousHrtimeNs),
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      rssBytes: memory.rss,
    };

    this.histogram.reset();
    this.previousElu = currentElu;
    this.previousCpu = process.cpuUsage();
    this.previousHrtimeNs = nowHrtimeNs;

    return snapshot;
  }

  disable(): void {
    this.histogram.disable();
  }
}

function nanosecondsToMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return roundTo(value / 1e6, 2);
}

function cpuPercent(cpuDelta: NodeJS.CpuUsage, elapsedNs: bigint): number {
  const elapsedUs = Number(elapsedNs) / 1000;
  if (!Number.isFinite(elapsedUs) || elapsedUs <= 0) {
    return 0;
  }

  return roundTo(((cpuDelta.user + cpuDelta.system) / elapsedUs) * 100, 1);
}

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
