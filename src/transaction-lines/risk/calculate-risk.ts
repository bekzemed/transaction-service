import type { RiskTaskInput } from './risk.types';

/** Currencies considered low-risk; everything else scores higher. */
export const LOW_RISK_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
]);

/** Amount at or above which the amount factor saturates at 1. */
export const AMOUNT_SATURATION = 10_000;

/**
 * Deterministic heuristic over amount, timestamp, and currency.
 * Returns an integer in [1, 100].
 */
export function calculateRisk(input: RiskTaskInput): number {
  const amountFactor = Math.min(
    Math.max(input.amount, 0) / AMOUNT_SATURATION,
    1,
  );

  const date = new Date(input.timestampMs);
  const hour = date.getUTCHours();
  const oddHourFactor = hour < 6 ? 1 : hour >= 22 ? 0.7 : 0.2;

  const currencyFactor = LOW_RISK_CURRENCIES.has(input.currency) ? 0.1 : 0.7;

  const risk = 0.5 * amountFactor + 0.3 * oddHourFactor + 0.2 * currencyFactor;

  return Math.min(Math.max(Math.round(risk * 100), 1), 100);
}
