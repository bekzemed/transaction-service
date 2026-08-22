import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
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
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      throw new InvalidStorageKeyError();
    }

    return join(this.root, storageKey);
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.resolvePath(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.resolvePath(storageKey));
  }
}
