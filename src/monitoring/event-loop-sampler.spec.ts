import { EventLoopSampler } from './event-loop-sampler';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('EventLoopSampler', () => {
  it('returns numeric values for the five process metrics', async () => {
    const sampler = new EventLoopSampler();
    await wait(40);

    const snapshot = sampler.sample();
    sampler.disable();

    expect(snapshot.eventLoopDelayMs.mean).toBeGreaterThanOrEqual(0);
    expect(snapshot.eventLoopDelayMs.p50).toBeGreaterThanOrEqual(0);
    expect(snapshot.eventLoopDelayMs.p99).toBeGreaterThanOrEqual(0);
    expect(snapshot.eventLoopDelayMs.max).toBeGreaterThanOrEqual(0);
    expect(snapshot.eventLoopUtilization).toBeGreaterThanOrEqual(0);
    expect(snapshot.eventLoopUtilization).toBeLessThanOrEqual(1);
    expect(snapshot.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.heapUsedBytes).toBeGreaterThan(0);
    expect(snapshot.heapTotalBytes).toBeGreaterThanOrEqual(snapshot.heapUsedBytes);
    expect(snapshot.rssBytes).toBeGreaterThanOrEqual(snapshot.heapTotalBytes);
  });

  it('reports elevated delay after a synchronous stall', async () => {
    const sampler = new EventLoopSampler();
    await wait(30);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 80) {
      // Busy-wait so the event-loop delay histogram observes a late timer.
    }

    await wait(30);
    const snapshot = sampler.sample();
    sampler.disable();

    expect(snapshot.eventLoopDelayMs.max).toBeGreaterThan(50);
  });
});
