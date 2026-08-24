import { ApiProperty } from '@nestjs/swagger';

export class ImportRejectionRto {
  @ApiProperty({ example: 125 })
  readonly lineNumber: number;

  @ApiProperty({ example: 'INVALID_CURRENCY' })
  readonly reason: string;

  @ApiProperty({
    example: 'Currency must be a supported three-letter code',
  })
  readonly message: string;

  @ApiProperty({
    description:
      'The original file line as text. Oversized values are truncated.',
    example: '{"transactionId":"txn-100"}',
  })
  readonly rawValue: string;

  constructor(
    lineNumber: number,
    reason: string,
    message: string,
    rawValue: string,
  ) {
    this.lineNumber = lineNumber;
    this.reason = reason;
    this.message = message;
    this.rawValue = rawValue;
  }

  static from(row: {
    lineNumber: number;
    reason: string;
    message: string;
    rawValue: string;
  }): ImportRejectionRto {
    return new ImportRejectionRto(
      row.lineNumber,
      row.reason,
      row.message,
      row.rawValue,
    );
  }
}
