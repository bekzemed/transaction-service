import { resolve } from 'node:path';

/**
 * Absolute root under which uploaded files are stored.
 *
 * The API and the processor run as separate processes, so this must not depend
 * on a relative path: both resolve the same root from `UPLOADS_DIR`.
 */
export function getUploadsRoot(): string {
  return resolve(process.env.UPLOADS_DIR ?? 'uploads');
}
