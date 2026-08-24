import { BadRequestException } from '@nestjs/common';
import {
  decodeRejectionCursor,
  encodeRejectionCursor,
} from './rejection-cursor';

describe('rejection-cursor', () => {
  it('round-trips an offset', () => {
    const cursor = encodeRejectionCursor(50);

    expect(decodeRejectionCursor(cursor)).toBe(50);
  });

  it('rejects malformed tokens', () => {
    expect(() => decodeRejectionCursor('not-a-cursor')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a negative offset', () => {
    const cursor = Buffer.from(JSON.stringify({ offset: -1 }), 'utf8').toString(
      'base64url',
    );

    expect(() => decodeRejectionCursor(cursor)).toThrow(BadRequestException);
  });
});
