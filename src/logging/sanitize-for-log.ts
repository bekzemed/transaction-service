/** Max characters kept from a single untrusted value in a log line. */
export const MAX_LOG_VALUE_CHARS = 200;

/**
 * Makes an untrusted value safe to interpolate into a log line.
 *
 * Control characters are what turn a value into a forged log entry: a newline
 * starts a fake record, and an ESC lets the value repaint a terminal. They are
 * replaced rather than dropped so the log still shows that something was
 * there. The length cap stops one value from flooding the stream.
 */
export function sanitizeForLog(
  value: unknown,
  maxChars: number = MAX_LOG_VALUE_CHARS,
): string {
  const text = typeof value === 'string' ? value : stringify(value);
  const stripped = text
    // eslint-disable-next-line no-control-regex -- intentional control-char strip
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');

  return stripped.length > maxChars
    ? `${stripped.slice(0, maxChars)}...`
    : stripped;
}

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable]';
  }
}
