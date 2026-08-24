import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import {
  createStorageKey,
  STORAGE_KEY_EXTENSIONS,
  type StorageKeyExtension,
} from '../../storage/file-storage.service';
import { getUploadsRoot } from '../../storage/storage.config';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS = new Set<string>(STORAGE_KEY_EXTENSIONS);
const ALLOWED_MIME_TYPES = new Set([
  'application/x-ndjson',
  'application/jsonl',
  'application/octet-stream',
  'text/plain',
]);

/**
 * Accepts a single NDJSON file under the `file` field.
 *
 * Multer streams the upload to disk, so the file is never held fully in
 * memory (the default memory storage would). Enforces the size limit and
 * rejects non-NDJSON uploads.
 */
export const NdjjsonFileInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    // Absolute, so the API and the processor agree on the location regardless
    // of the directory each process was started from.
    destination: getUploadsRoot(),
    // Never trust the client-provided filename.
    filename: (_req, file, callback) =>
      callback(
        null,
        createStorageKey(
          extname(file.originalname).toLowerCase() as StorageKeyExtension,
        ),
      ),
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 8,
    fieldSize: 1024,
    fieldNameSize: 100,
    parts: 10,
    headerPairs: 50,
  },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.has(extension) ||
      !ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      return callback(
        new BadRequestException(
          'Only NDJSON files (.ndjson, .jsonl) are supported',
        ),
        false,
      );
    }
    callback(null, true);
  },
});
