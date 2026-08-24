import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImportCancelDto {
  @ApiPropertyOptional({
    example: 'Duplicate file uploaded in error',
    nullable: true,
    type: String,
    maxLength: 500,
  })
  readonly reason?: string | null;
}
