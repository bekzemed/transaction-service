import { sanitizeForLog } from './sanitize-for-log';

describe('sanitizeForLog', () => {
  it('replaces newlines and escape sequences so they cannot forge a log line', () => {
    expect(sanitizeForLog('ok\nERROR forged\u001b[31m')).toBe(
      'ok ERROR forged [31m',
    );
  });

  it('caps the interpolated value', () => {
    const value = sanitizeForLog('a'.repeat(250));

    expect(value.endsWith('...')).toBe(true);
    expect(value.length).toBe(203);
  });

  it('stringifies objects and errors without throwing', () => {
    expect(sanitizeForLog({ jobId: 'abc' })).toBe('{"jobId":"abc"}');
    expect(sanitizeForLog(new Error('boom'))).toBe('Error: boom');
  });
});
