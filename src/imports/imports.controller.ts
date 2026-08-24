import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NdjjsonFileInterceptor } from './interceptors/ndjson-file.interceptor';
import { ImportsService } from './imports.service';
import { ImportResponseRto } from './rto/import-response.rto';
import { ImportStatusRto } from './rto/import-status.rto';
import { ImportSummaryRto } from './rto/import-summary.rto';

@ApiTags('imports')
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

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
    @UploadedFile() file: Express.Multer.File,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ImportResponseRto> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!file) {
      throw new BadRequestException('An NDJSON file is required');
    }

    const job = await this.importsService.createImport(
      idempotencyKey.trim(),
      file.filename,
    );

    return ImportResponseRto.fromJob(job);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Get reconciliation summary',
    description:
      'Returns accepted/rejected/duplicate totals for an import job, ' +
      'plus transaction-line aggregations by currency, risk level, merchant, and account.',
  })
  @ApiParam({
    name: 'id',
    description: 'Import job ID',
    format: 'uuid',
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  @ApiOkResponse({ type: ImportSummaryRto })
  @ApiBadRequestResponse({ description: 'Invalid import job ID' })
  @ApiNotFoundResponse({ description: 'Import job not found' })
  async getImportSummary(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportSummaryRto> {
    return this.importsService.getImportSummary(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get import status',
    description:
      'Returns the current status and progress of a specific import job.',
  })
  @ApiParam({
    name: 'id',
    description: 'Import job ID',
    format: 'uuid',
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  @ApiOkResponse({ type: ImportStatusRto })
  @ApiBadRequestResponse({ description: 'Invalid import job ID' })
  @ApiNotFoundResponse({ description: 'Import job not found' })
  async getImport(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportStatusRto> {
    const job = await this.importsService.getImport(id);
    return ImportStatusRto.fromJob(job);
  }
}
