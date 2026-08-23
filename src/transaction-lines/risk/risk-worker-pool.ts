import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { RiskResult, RiskTaskInput } from './risk.types';

interface WaitingAcquire {
  resolve: (worker: Worker) => void;
  reject: (error: Error) => void;
}

interface InflightSend {
  resolve: (result: RiskResult) => void;
  reject: (error: Error) => void;
  onMessage: (result: RiskResult) => void;
}

/**
 * Fixed-size worker-thread pool. run() borrows a thread, sends one line,
 * waits for the result, then returns the thread. If none are free, run()
 * waits until one is.
 */
@Injectable()
export class RiskWorkerPool implements OnModuleDestroy {
  private readonly logger = new Logger(RiskWorkerPool.name);
  private readonly poolSize = getRiskWorkerThreads();
  private readonly simulationMs = getRiskSimulationMs();

  private readonly idle: Worker[] = [];
  private readonly waiting: WaitingAcquire[] = [];
  private readonly inflight = new Map<Worker, InflightSend>();
  private workers: Worker[] = [];
  private started = false;
  private destroyed = false;

  async run(input: RiskTaskInput): Promise<RiskResult> {
    if (this.destroyed) {
      throw new Error('RiskWorkerPool has been destroyed');
    }
    this.ensureStarted();

    const worker = await this.acquire();
    try {
      const result = await this.send(worker, input);
      this.release(worker);
      return result;
    } catch (error) {
      this.drop(worker);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;

    const shutdownError = new Error('RiskWorkerPool has been destroyed');
    for (const waiter of this.waiting.splice(0)) {
      waiter.reject(shutdownError);
    }
    for (const [worker, pending] of this.inflight) {
      worker.off('message', pending.onMessage);
      pending.reject(shutdownError);
    }
    this.inflight.clear();

    await Promise.allSettled(this.workers.map((worker) => worker.terminate()));
    this.workers = [];
    this.idle.length = 0;
  }

  private acquire(): Promise<Worker> {
    if (this.destroyed) {
      return Promise.reject(new Error('RiskWorkerPool has been destroyed'));
    }
    const worker = this.idle.pop();
    if (worker) {
      return Promise.resolve(worker);
    }
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
    });
  }

  private release(worker: Worker): void {
    if (this.destroyed) {
      return;
    }
    const next = this.waiting.shift();
    if (next) {
      next.resolve(worker);
    } else {
      this.idle.push(worker);
    }
  }

  private send(worker: Worker, input: RiskTaskInput): Promise<RiskResult> {
    return new Promise((resolve, reject) => {
      const onMessage = (result: RiskResult) => {
        this.inflight.delete(worker);
        resolve(result);
      };
      this.inflight.set(worker, { resolve, reject, onMessage });
      worker.once('message', onMessage);
      worker.postMessage(input);
    });
  }

  private ensureStarted(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    for (let i = 0; i < this.poolSize; i += 1) {
      this.idle.push(this.spawn());
    }
    this.logger.log(
      `Started risk worker pool: threads=${this.poolSize} simulationMs=${this.simulationMs}`,
    );
  }

  private spawn(): Worker {
    const worker = new Worker(join(__dirname, 'risk.worker.js'), {
      workerData: { simulationMs: this.simulationMs },
    });

    worker.on('error', (error: Error) => {
      this.failWorker(worker, error);
    });
    worker.on('exit', (code) => {
      if (!this.destroyed) {
        this.failWorker(
          worker,
          new Error(`Risk worker exited with code ${code}`),
        );
      }
    });

    this.workers.push(worker);
    return worker;
  }

  /**
   * Rejects an in-flight send if one exists, then replaces the worker.
   * Safe to call more than once for the same worker (error followed by exit).
   */
  private failWorker(worker: Worker, error: Error): void {
    const pending = this.inflight.get(worker);
    if (pending) {
      this.inflight.delete(worker);
      worker.off('message', pending.onMessage);
      pending.reject(error);
    }

    if (this.destroyed) {
      return;
    }

    const wasTracked = this.workers.includes(worker);
    this.drop(worker);
    if (wasTracked) {
      this.logger.error(`Risk worker failed: ${error.message}`);
    }
  }

  /** Discard a worker if it is still in the pool; spawn a replacement. */
  private drop(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index === -1) {
      return;
    }

    this.workers.splice(index, 1);
    const idleIndex = this.idle.indexOf(worker);
    if (idleIndex !== -1) {
      this.idle.splice(idleIndex, 1);
    }

    void worker.terminate();

    if (!this.destroyed) {
      this.release(this.spawn());
    }
  }
}

function getRiskWorkerThreads(): number {
  return Math.max(1, availableParallelism() - 2);
}

function getRiskSimulationMs(): number {
  const value = Number(process.env.RISK_SIMULATION_MS);
  return Number.isInteger(value) && value >= 0 ? value : 2000;
}
