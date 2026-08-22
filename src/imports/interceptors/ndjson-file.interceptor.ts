import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS = new Set(['.ndjson', '.jsonl']);
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
    destination: 'uploads',
    // Never trust the client-provided filename.
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
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
