import { BadRequestException } from '@nestjs/common';

/** JSON and urlencoded bodies stay small; NDJSON uploads go through Multer. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

export const MAX_CANCEL_REASON_CHARS = 500;

export const MAX_IDEMPOTENCY_KEY_CHARS = 128;

/**
 * Printable token characters only. Newlines and spaces would either forge a
 * second header or collide with how clients copy keys around.
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function parseIdempotencyKey(value?: string): string {
  const key = value?.trim();
  if (!key) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_CHARS) {
    throw new BadRequestException(
      `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_CHARS} characters`,
    );
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new BadRequestException(
      'Idempotency-Key may contain only letters, digits, ".", "_", ":", and "-"',
    );
  }

  return key;
}

export function parseCancelReason(reason: unknown): string | null {
  if (reason == null) {
    return null;
  }
  if (typeof reason !== 'string') {
    throw new BadRequestException('reason must be a string');
  }

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_CANCEL_REASON_CHARS) {
    throw new BadRequestException(
      `reason must be at most ${MAX_CANCEL_REASON_CHARS} characters`,
    );
  }

  return trimmed;
}
