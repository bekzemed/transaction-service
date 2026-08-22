export type RejectionCode =
  | 'LINE_TOO_LONG'
  | 'INVALID_JSON'
  | 'INVALID_RECORD'
  | 'MISSING_FIELD'
  | 'INVALID_TRANSACTION_ID'
  | 'INVALID_ACCOUNT_ID'
  | 'INVALID_MERCHANT_ID'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'UNSUPPORTED_CURRENCY'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_DESCRIPTION'
  | 'DESCRIPTION_TOO_LONG';

export interface NormalizedTransaction {
  transactionId: string;
  accountId: string;
  merchantId: string;
  amount: number;
  currency: string;
  timestamp: string;
  description: string | null;
}

export interface TransactionRejection {
  lineNumber: number;
  reason: RejectionCode;
  message: string;
  rawValue: unknown;
}

export type ValidateResult =
  | { ok: true; value: NormalizedTransaction }
  | { ok: false; reason: RejectionCode; message: string; rawValue: unknown };

export interface ParseTransactionsResult {
  passed: NormalizedTransaction[];
  rejected: TransactionRejection[];
}

export interface BatchValidationResult {
  rejected: TransactionRejection[];
  /** Rows actually written by createManyAndReturn. */
  inserted: PersistedTransactionLine[];
  duplicateCount: number;
}

/** Subset of the Prisma TransactionLine row the handler needs after insert. */
export interface PersistedTransactionLine {
  id: string;
  transactionId: string;
  accountId: string;
  merchantId: string;
  amount: unknown;
  currency: string;
  timestamp: Date;
  description: string | null;
  fingerprint: string;
  createdAt: Date;
}

export interface JobProgressCounts {
  processed: number;
  accepted: number;
  rejected: number;
  duplicates: number;
}

export interface FingerprintInput {
  accountId: string;
  merchantId: string;
  amount: number;
  timestamp: string;
}
