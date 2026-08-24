import { BadRequestException } from '@nestjs/common';

interface RejectionCursorPayload {
  offset: number;
}

export function encodeRejectionCursor(offset: number): string {
  const payload: RejectionCursorPayload = { offset };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeRejectionCursor(cursor: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException('Invalid cursor');
  }

  const offset = (parsed as RejectionCursorPayload).offset;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new BadRequestException('Invalid cursor');
  }

  return offset;
}
