import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImportCancelDto {
  @ApiPropertyOptional({
    example: 'Duplicate file uploaded in error',
    nullable: true,
    type: String,
  })
  readonly reason?: string | null;
}
