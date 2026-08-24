/**
 * Worker-thread entry point for risk calculation. Runs outside NestJS —
 * keep this file free of framework imports. The pool spawns it from the
 * compiled output (dist/.../risk.worker.js).
 */
import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { calculateRisk } from './calculate-risk';
import type { RiskResult, RiskTaskInput, RiskWorkerData } from './risk.types';

const { simulationMs } = workerData as RiskWorkerData;

if (!parentPort) {
  throw new Error('risk.worker must be run as a worker thread');
}

parentPort.on('message', (input: RiskTaskInput) => {
  const risk = calculateRisk(input);
  burnCpu(simulationMs);
  const result: RiskResult = {
    transactionLineId: input.transactionLineId,
    risk,
  };
  parentPort!.postMessage(result);
});

/** Simulates CPU-intensive work by hashing in a tight loop for `ms`. */
function burnCpu(ms: number): void {
  const deadline = Date.now() + ms;
  let digest = 'seed';
  while (Date.now() < deadline) {
    digest = createHash('sha256').update(digest).digest('hex');
  }
}
