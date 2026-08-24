import { ApiProperty } from '@nestjs/swagger';
import { Job } from 'generated/prisma/client';

export class ImportSummaryTotalsRto {
  @ApiProperty({ example: 57010 })
  readonly accepted: number;

  @ApiProperty({ example: 1190 })
  readonly rejected: number;

  @ApiProperty({ example: 214 })
  readonly duplicates: number;

  constructor(accepted: number, rejected: number, duplicates: number) {
    this.accepted = accepted;
    this.rejected = rejected;
    this.duplicates = duplicates;
  }

  static fromJob(job: Job): ImportSummaryTotalsRto {
    return new ImportSummaryTotalsRto(
      job.accepted,
      job.rejected,
      job.duplicates,
    );
  }
}

export class ImportSummaryCurrencyRto {
  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  @ApiProperty({ example: 25000 })
  readonly transactionCount: number;

  @ApiProperty({ example: 4350210.42 })
  readonly totalAmount: number;

  constructor(currency: string, transactionCount: number, totalAmount: number) {
    this.currency = currency;
    this.transactionCount = transactionCount;
    this.totalAmount = totalAmount;
  }

  static fromRows(
    rows: Array<{
      currency: string;
      _count: { _all: number };
      _sum: { amount: unknown } | null;
    }>,
  ): ImportSummaryCurrencyRto[] {
    return rows.map(
      (row) =>
        new ImportSummaryCurrencyRto(
          row.currency,
          row._count._all,
          Number(row._sum?.amount ?? 0),
        ),
    );
  }
}

export class ImportSummaryMerchantRto {
  @ApiProperty({ example: 'merchant-18' })
  readonly merchantId: string;

  @ApiProperty({ example: 1200 })
  readonly transactionCount: number;

  constructor(merchantId: string, transactionCount: number) {
    this.merchantId = merchantId;
    this.transactionCount = transactionCount;
  }

  static fromRows(
    rows: Array<{ merchantId: string; _count: { _all: number } }>,
  ): ImportSummaryMerchantRto[] {
    return rows.map(
      (row) => new ImportSummaryMerchantRto(row.merchantId, row._count._all),
    );
  }
}

export class ImportSummaryAccountRto {
  @ApiProperty({ example: 'acc-201' })
  readonly accountId: string;

  @ApiProperty({ example: 340 })
  readonly transactionCount: number;

  constructor(accountId: string, transactionCount: number) {
    this.accountId = accountId;
    this.transactionCount = transactionCount;
  }

  static fromRows(
    rows: Array<{ accountId: string; _count: { _all: number } }>,
  ): ImportSummaryAccountRto[] {
    return rows.map(
      (row) => new ImportSummaryAccountRto(row.accountId, row._count._all),
    );
  }
}

export class ImportSummaryRiskLevelRto {
  @ApiProperty({ example: 41000, description: 'Risk scores 1–33' })
  readonly low: number;

  @ApiProperty({ example: 14000, description: 'Risk scores 34–66' })
  readonly medium: number;

  @ApiProperty({ example: 2010, description: 'Risk scores 67–100' })
  readonly high: number;

  constructor(low: number, medium: number, high: number) {
    this.low = low;
    this.medium = medium;
    this.high = high;
  }

  static from(
    low: number,
    medium: number,
    high: number,
  ): ImportSummaryRiskLevelRto {
    return new ImportSummaryRiskLevelRto(low, medium, high);
  }
}

export class ImportSummaryRto {
  @ApiProperty({
    example: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
  })
  readonly importId: string;

  @ApiProperty({ type: ImportSummaryTotalsRto })
  readonly totals: ImportSummaryTotalsRto;

  @ApiProperty({ type: [ImportSummaryCurrencyRto] })
  readonly byCurrency: ImportSummaryCurrencyRto[];

  @ApiProperty({ type: ImportSummaryRiskLevelRto })
  readonly byRiskLevel: ImportSummaryRiskLevelRto;

  @ApiProperty({ type: [ImportSummaryMerchantRto] })
  readonly byMerchant: ImportSummaryMerchantRto[];

  @ApiProperty({ type: [ImportSummaryAccountRto] })
  readonly byAccount: ImportSummaryAccountRto[];

  constructor(
    importId: string,
    totals: ImportSummaryTotalsRto,
    byCurrency: ImportSummaryCurrencyRto[],
    byRiskLevel: ImportSummaryRiskLevelRto,
    byMerchant: ImportSummaryMerchantRto[],
    byAccount: ImportSummaryAccountRto[],
  ) {
    this.importId = importId;
    this.totals = totals;
    this.byCurrency = byCurrency;
    this.byRiskLevel = byRiskLevel;
    this.byMerchant = byMerchant;
    this.byAccount = byAccount;
  }

  static from(
    importId: string,
    totals: ImportSummaryTotalsRto,
    byCurrency: ImportSummaryCurrencyRto[],
    byRiskLevel: ImportSummaryRiskLevelRto,
    byMerchant: ImportSummaryMerchantRto[],
    byAccount: ImportSummaryAccountRto[],
  ): ImportSummaryRto {
    return new ImportSummaryRto(
      importId,
      totals,
      byCurrency,
      byRiskLevel,
      byMerchant,
      byAccount,
    );
  }
}
