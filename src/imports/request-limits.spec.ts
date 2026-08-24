import { BadRequestException } from '@nestjs/common';
import {
  MAX_CANCEL_REASON_CHARS,
  MAX_IDEMPOTENCY_KEY_CHARS,
  parseCancelReason,
  parseIdempotencyKey,
} from './request-limits';

describe('parseIdempotencyKey', () => {
  it('accepts a trimmed UUID', () => {
    expect(parseIdempotencyKey('  import-2026-08-24  ')).toBe(
      'import-2026-08-24',
    );
  });

  it('rejects a missing key', () => {
    expect(() => parseIdempotencyKey(undefined)).toThrow(BadRequestException);
    expect(() => parseIdempotencyKey('   ')).toThrow(BadRequestException);
  });

  it('rejects a key that is too long', () => {
    expect(() =>
      parseIdempotencyKey('a'.repeat(MAX_IDEMPOTENCY_KEY_CHARS + 1)),
    ).toThrow(BadRequestException);
  });

  it('rejects newlines and spaces inside the key', () => {
    expect(() => parseIdempotencyKey('abc\ndef')).toThrow(BadRequestException);
    expect(() => parseIdempotencyKey('abc def')).toThrow(BadRequestException);
  });
});

describe('parseCancelReason', () => {
  it('returns null for missing or blank values', () => {
    expect(parseCancelReason(undefined)).toBeNull();
    expect(parseCancelReason(null)).toBeNull();
    expect(parseCancelReason('   ')).toBeNull();
  });

  it('trims a valid reason', () => {
    expect(parseCancelReason('  duplicate upload  ')).toBe('duplicate upload');
  });

  it('rejects a non-string reason', () => {
    expect(() => parseCancelReason(12)).toThrow(BadRequestException);
  });

  it('rejects a reason that is too long', () => {
    expect(() =>
      parseCancelReason('x'.repeat(MAX_CANCEL_REASON_CHARS + 1)),
    ).toThrow(BadRequestException);
  });
});
