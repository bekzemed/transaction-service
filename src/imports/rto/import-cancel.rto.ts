import { ApiProperty } from '@nestjs/swagger';
import { CancellationRequest } from 'generated/prisma/client';

export class ImportCancelRto {
  @ApiProperty({
    example: 'c3d4e5f6-7a89-4b0c-9d1e-ef2a3b4c5d6e',
  })
  readonly id: string;

  @ApiProperty({
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  readonly jobId: string;

  @ApiProperty({
    example: 'Duplicate file uploaded in error',
    nullable: true,
    type: String,
  })
  readonly reason: string | null;

  @ApiProperty({
    example: '2026-07-24T08:02:00.000Z',
  })
  readonly createdAt: string;

  constructor(
    id: string,
    jobId: string,
    reason: string | null,
    createdAt: string,
  ) {
    this.id = id;
    this.jobId = jobId;
    this.reason = reason;
    this.createdAt = createdAt;
  }

  static fromCancellationRequest(
    cancellationRequest: CancellationRequest,
  ): ImportCancelRto {
    return new ImportCancelRto(
      cancellationRequest.id,
      cancellationRequest.jobId,
      cancellationRequest.reason,
      cancellationRequest.createdAt.toISOString(),
    );
  }
}
