import { MAX_RAW_VALUE_CHARS } from './transaction-line.constants';

/**
 * Caps malformed or oversized raw input before it is persisted.
 * Always returns a string so the database never stores unbounded payloads.
 */
export function limitRawValue(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.length > MAX_RAW_VALUE_CHARS
      ? raw.slice(0, MAX_RAW_VALUE_CHARS)
      : raw;
  }

  try {
    const serialized = JSON.stringify(raw);
    if (serialized === undefined) {
      return '';
    }
    return serialized.length > MAX_RAW_VALUE_CHARS
      ? serialized.slice(0, MAX_RAW_VALUE_CHARS)
      : serialized;
  } catch {
    return '';
  }
}
