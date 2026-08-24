import { resolve } from 'node:path';

export const DEFAULT_UPLOADS_RETENTION_HOURS = 24;

/**
 * Absolute root under which uploaded files are stored.
 *
 * The API and the processor run as separate processes, so this must not depend
 * on a relative path: both resolve the same root from `UPLOADS_DIR`.
 */
export function getUploadsRoot(): string {
  return resolve(process.env.UPLOADS_DIR ?? 'uploads');
}

/**
 * Age after which an upload with no remaining owner is deleted.
 * `UPLOADS_RETENTION_HOURS=0` disables the sweeper.
 */
export function getUploadsRetentionMs(): number | null {
  const raw = process.env.UPLOADS_RETENTION_HOURS;
  if (raw === '0') {
    return null;
  }

  const hours = Number(raw);
  const value =
    Number.isInteger(hours) && hours > 0
      ? hours
      : DEFAULT_UPLOADS_RETENTION_HOURS;

  return value * 60 * 60 * 1000;
}
