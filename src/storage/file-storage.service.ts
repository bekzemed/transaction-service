import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getUploadsRoot } from './storage.config';

export const STORAGE_KEY_EXTENSIONS = ['.ndjson', '.jsonl'] as const;

export type StorageKeyExtension = (typeof STORAGE_KEY_EXTENSIONS)[number];

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(ndjson|jsonl)$/;

/**
 * Builds the only shape of name this service will ever accept back, so a key
 * can never contain a separator or a traversal segment.
 */
export function createStorageKey(extension: StorageKeyExtension): string {
  return `${randomUUID()}${extension}`;
}

export function isStorageKey(value: string): boolean {
  return STORAGE_KEY_PATTERN.test(value);
}

export class InvalidStorageKeyError extends Error {
  constructor() {
    super('Storage key does not match the expected format');
  }
}

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly root = getUploadsRoot();

  async onModuleInit(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  /**
   * Storage keys arrive over the message queue, so they are untrusted input.
   * Matching the generated format is what keeps the result inside the root.
   */
  resolvePath(storageKey: string): string {
    if (!isStorageKey(storageKey)) {
      throw new InvalidStorageKeyError();
    }

    return join(this.root, storageKey);
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.resolvePath(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storageKey));
    } catch (error) {
      if (!isEnoent(error)) {
        throw error;
      }
    }
  }

  /**
   * Deletes generated upload files older than `maxAgeMs`. Names that are not
   * storage keys are left alone so a misconfigured root cannot wipe itself.
   */
  async removeStaleFiles(maxAgeMs: number): Promise<number> {
    const names = await readdir(this.root);
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const name of names) {
      if (!isStorageKey(name)) {
        continue;
      }

      try {
        const info = await stat(this.resolvePath(name));
        if (info.mtimeMs > cutoff) {
          continue;
        }

        await this.remove(name);
        removed += 1;
      } catch {
        // A file may vanish between readdir and unlink; keep sweeping.
      }
    }

    return removed;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
