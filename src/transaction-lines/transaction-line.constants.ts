/**
 * Currencies this service accepts. The assignment treats "unsupported
 * currency codes" as distinct from malformed ones, so the format check and
 * this allowlist produce different rejection codes.
 */
export const SUPPORTED_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'CNY',
  'HKD',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'SGD',
  'INR',
  'BRL',
  'MXN',
  'ZAR',
  'KRW',
  'TRY',
  'PLN',
  'AED',
  'SAR',
  'ILS',
  'THB',
  'IDR',
  'MYR',
  'PHP',
  'TWD',
  'ETB',
]);

/** Hard cap on a single NDJSON line before JSON.parse (DoS guard). */
export const DEFAULT_MAX_LINE_BYTES = 64 * 1024;

/** Max characters persisted from a malformed raw line / object. */
export const MAX_RAW_VALUE_CHARS = 1024;

export const MAX_DESCRIPTION_LENGTH = 500;

/** ISO-8601 with required date and time; fractional seconds optional. */
export const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Inclusive upper bound of the low risk bucket (scores 1–39). */
export const RISK_LEVEL_LOW_MAX = 39;

/** Inclusive upper bound of the medium risk bucket (scores 40–70). High is 71–100. */
export const RISK_LEVEL_MEDIUM_MAX = 70;
