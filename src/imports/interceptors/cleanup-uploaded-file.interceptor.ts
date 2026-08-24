import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';
import { FileStorageService } from '../../storage/file-storage.service';

/**
 * Deletes the Multer disk file when the request fails after the file was
 * accepted. Multer already unlinks on its own limit errors; this covers the
 * handler throwing (job insert, publish, validation) so a 4xx/5xx never
 * leaves an orphan in the uploads root.
 */
@Injectable()
export class CleanupUploadedFileInterceptor implements NestInterceptor {
  constructor(private readonly fileStorage: FileStorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ file?: Express.Multer.File }>();

    return next.handle().pipe(
      catchError((error: unknown) => {
        void this.removeUploadedFile(request.file);
        return throwError(() => error);
      }),
    );
  }

  private async removeUploadedFile(file?: Express.Multer.File): Promise<void> {
    if (!file?.filename) {
      return;
    }

    try {
      await this.fileStorage.remove(file.filename);
    } catch {
      // Never mask the original request error.
    }
  }
}
