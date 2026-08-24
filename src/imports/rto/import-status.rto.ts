import { ApiProperty } from '@nestjs/swagger';
import { Job } from 'generated/prisma/client';
import { JobStatus } from 'generated/prisma/enums';

export class ImportProgressRto {
  @ApiProperty({ example: 58200 })
  readonly processed: number;

  @ApiProperty({ example: 57010 })
  readonly accepted: number;

  @ApiProperty({ example: 1190 })
  readonly rejected: number;

  @ApiProperty({ example: 214 })
  readonly duplicates: number;

  constructor(
    processed: number,
    accepted: number,
    rejected: number,
    duplicates: number,
  ) {
    this.processed = processed;
    this.accepted = accepted;
    this.rejected = rejected;
    this.duplicates = duplicates;
  }
}

export class ImportStatusRto {
  @ApiProperty({
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  readonly id: string;

  @ApiProperty({
    example: 'processing',
    enum: [
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelling',
      'cancelled',
    ],
  })
  readonly status: JobStatus;

  @ApiProperty({ type: ImportProgressRto })
  readonly progress: ImportProgressRto;

  @ApiProperty({
    example: '2026-07-24T08:01:00.000Z',
    nullable: true,
    type: String,
  })
  readonly startedAt: string | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
  })
  readonly completedAt: string | null;

  constructor(
    id: string,
    status: JobStatus,
    progress: ImportProgressRto,
    startedAt: string | null,
    completedAt: string | null,
  ) {
    this.id = id;
    this.status = status;
    this.progress = progress;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
  }

  static fromJob(job: Job): ImportStatusRto {
    return new ImportStatusRto(
      job.id,
      job.status,
      new ImportProgressRto(
        job.processed,
        job.accepted,
        job.rejected,
        job.duplicates,
      ),
      job.startedAt?.toISOString() ?? null,
      job.completedAt?.toISOString() ?? null,
    );
  }
}
