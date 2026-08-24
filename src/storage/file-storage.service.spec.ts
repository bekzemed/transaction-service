import { mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createStorageKey,
  FileStorageService,
  InvalidStorageKeyError,
} from './file-storage.service';

describe('FileStorageService', () => {
  let previousUploadsDir: string | undefined;
  let dir: string;
  let service: FileStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = dir;
    service = new FileStorageService();
    await service.onModuleInit();
  });

  afterEach(() => {
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
  });

  it('rejects a traversal-shaped storage key', () => {
    expect(() => service.resolvePath('../secret.ndjson')).toThrow(
      InvalidStorageKeyError,
    );
  });

  it('removes a stored file and ignores a second remove', async () => {
    const storageKey = createStorageKey('.ndjson');
    const path = service.resolvePath(storageKey);
    await writeFile(path, '{"ok":true}\n');

    await service.remove(storageKey);
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.remove(storageKey)).resolves.toBeUndefined();
  });

  it('deletes only stale generated uploads', async () => {
    const staleKey = createStorageKey('.ndjson');
    const freshKey = createStorageKey('.jsonl');
    const stalePath = service.resolvePath(staleKey);
    const freshPath = service.resolvePath(freshKey);
    const notesPath = join(dir, 'notes.txt');

    await writeFile(stalePath, 'stale\n');
    await writeFile(freshPath, 'fresh\n');
    await writeFile(notesPath, 'keep\n');

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(stalePath, twoDaysAgo, twoDaysAgo);

    const removed = await service.removeStaleFiles(24 * 60 * 60 * 1000);

    expect(removed).toBe(1);
    await expect(readFile(stalePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(freshPath)).resolves.toBeDefined();
    await expect(readFile(notesPath)).resolves.toBeDefined();
  });
});
