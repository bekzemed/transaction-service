import { ApiProperty } from '@nestjs/swagger';
import { Job } from 'generated/prisma/client';
import { JobStatus } from 'generated/prisma/enums';

export class ImportResponseRto {
  @ApiProperty({
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  readonly id: string;

  @ApiProperty({
    example: 'pending',
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

  @ApiProperty({
    example: '2026-07-24T08:00:00.000Z',
  })
  readonly createdAt: string;

  constructor(id: string, status: JobStatus, createdAt: string) {
    this.id = id;
    this.status = status;
    this.createdAt = createdAt;
  }

  static fromJob(job: Job): ImportResponseRto {
    return new ImportResponseRto(
      job.id,
      job.status,
      job.createdAt.toISOString(),
    );
  }
}
