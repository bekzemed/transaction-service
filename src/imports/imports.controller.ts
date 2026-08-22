import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JobsService } from '../jobs/jobs.service';
import { NdjjsonFileInterceptor } from './interceptors/ndjson-file.interceptor';
import { ImportResponseRto } from './rto/import-response.rto';

@ApiTags('imports')
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(NdjjsonFileInterceptor)
  @ApiOperation({
    summary: 'Create an import',
    description:
      'Accepts an NDJSON transaction file and queues it for asynchronous processing. ' +
      'The response is returned before processing completes.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'NDJSON file (.ndjson or .jsonl), max 100 MB',
        },
      },
    },
  })
  @ApiAcceptedResponse({ type: ImportResponseRto })
  @ApiBadRequestResponse({
    description: 'Missing Idempotency-Key, missing file, or invalid file type',
  })
  @ApiPayloadTooLargeResponse({
    description: 'The uploaded file exceeds the allowed size',
  })
  async createImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ImportResponseRto> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!file) {
      throw new BadRequestException('An NDJSON file is required');
    }

    const job = await this.jobsService.createImportJob(idempotencyKey.trim());

    return ImportResponseRto.fromJob(job);
  }
}
