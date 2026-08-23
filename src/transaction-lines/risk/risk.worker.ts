/**
 * Worker-thread entry point for risk calculation. Runs outside NestJS —
 * keep this file free of framework imports. The pool spawns it from the
 * compiled output (dist/.../risk.worker.js).
 */
import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import type { RiskResult, RiskTaskInput, RiskWorkerData } from './risk.types';

/** Currencies considered low-risk; everything else scores higher. */
const LOW_RISK_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
]);

/** Amount at or above which the amount factor saturates at 1. */
const AMOUNT_SATURATION = 10_000;

const { simulationMs } = workerData as RiskWorkerData;

if (!parentPort) {
  throw new Error('risk.worker must be run as a worker thread');
}

parentPort.on('message', (input: RiskTaskInput) => {
  const risk = calculateRisk(input);
  const result: RiskResult = {
    transactionLineId: input.transactionLineId,
    risk,
  };
  parentPort!.postMessage(result);
});

/**
 * Simple deterministic heuristic over amount, timestamp, and currency,
 * followed by a busy loop simulating CPU-intensive model execution.
 */
function calculateRisk(input: RiskTaskInput): number {
  // Larger amounts are riskier, saturating at AMOUNT_SATURATION.
  const amountFactor = Math.min(
    Math.max(input.amount, 0) / AMOUNT_SATURATION,
    1,
  );

  // Transactions at unusual hours (00:00–05:59 UTC) are riskier.
  const date = new Date(input.timestampMs);
  const hour = date.getUTCHours();
  const oddHourFactor = hour < 6 ? 1 : hour >= 22 ? 0.7 : 0.2;

  const currencyFactor = LOW_RISK_CURRENCIES.has(input.currency) ? 0.1 : 0.7;

  const risk = 0.5 * amountFactor + 0.3 * oddHourFactor + 0.2 * currencyFactor;

  burnCpu(simulationMs);

  return Math.min(Math.max(Math.round(risk * 100), 1), 100);
}

/** Simulates CPU-intensive work by hashing in a tight loop for `ms`. */
function burnCpu(ms: number): void {
  const deadline = Date.now() + ms;
  let digest = 'seed';
  while (Date.now() < deadline) {
    digest = createHash('sha256').update(digest).digest('hex');
  }
}
