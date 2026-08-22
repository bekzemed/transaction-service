import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma, TransactionLine } from '../../generated/prisma/client';
import { TransactionLinesRepository } from './transaction-lines.repository';
import {
  ISO_8601_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_RAW_VALUE_CHARS,
  SUPPORTED_CURRENCIES,
} from './transaction-line.constants';
import type {
  FingerprintInput,
  NormalizedTransaction,
  RejectionCode,
  ValidateResult,
} from './transaction-line.types';

interface RawTransactionFields {
  transactionId?: unknown;
  accountId?: unknown;
  merchantId?: unknown;
  amount?: unknown;
  currency?: unknown;
  timestamp?: unknown;
  description?: unknown;
}

@Injectable()
export class TransactionLinesService {
  constructor(
    private readonly transactionLinesRepository: TransactionLinesRepository,
  ) {}

  /**
   * Normalize then validate a single parsed JSON value.
   * Returns a result object — never throws for record-level problems.
   */
  validate(raw: unknown): ValidateResult {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return this.reject(
        'INVALID_RECORD',
        'Each line must be a JSON object',
        raw,
      );
    }

    const input = raw as RawTransactionFields;

    let normalized: NormalizedTransaction;
    try {
      normalized = this.normalize(input);
    } catch (error) {
      if (error instanceof NormalizationError) {
        return this.reject(error.code, error.message, this.limitRaw(raw));
      }
      throw error;
    }

    return this.validateNormalized(normalized, raw);
  }

  /**
   * Deterministic SHA-256 over accountId, merchantId, amount, timestamp
   * in that exact order (normalized forms).
   */
  calculateFingerprint(input: FingerprintInput): string {
    return createHash('sha256')
      .update(input.accountId)
      .update('\0')
      .update(input.merchantId)
      .update('\0')
      .update(input.amount.toFixed(2))
      .update('\0')
      .update(input.timestamp)
      .digest('hex');
  }

  /**
   * Fingerprints each row then inserts with optional skipDuplicates.
   * Callers deduce duplicates as `transactions.length - returned.length`.
   */
  async createManyAndReturn(
    transactions: NormalizedTransaction[],
    options: { skipDuplicates?: boolean } = {},
  ): Promise<TransactionLine[]> {
    if (transactions.length === 0) {
      return [];
    }

    const data: Prisma.TransactionLineCreateManyInput[] = transactions.map(
      (transaction) => ({
        ...transaction,
        timestamp: new Date(transaction.timestamp),
        fingerprint: this.calculateFingerprint({
          accountId: transaction.accountId,
          merchantId: transaction.merchantId,
          amount: transaction.amount,
          timestamp: transaction.timestamp,
        }),
      }),
    );

    return this.transactionLinesRepository.createManyAndReturn({
      data,
      ...options,
    });
  }

  /**
   * Produces a deterministic field representation. Throws NormalizationError
   * for values that cannot be safely normalized.
   */
  private normalize(input: RawTransactionFields): NormalizedTransaction {
    return {
      transactionId: this.normalizeRequiredString(
        input.transactionId,
        'transactionId',
        'INVALID_TRANSACTION_ID',
      ),
      accountId: this.normalizeRequiredString(
        input.accountId,
        'accountId',
        'INVALID_ACCOUNT_ID',
      ),
      merchantId: this.normalizeRequiredString(
        input.merchantId,
        'merchantId',
        'INVALID_MERCHANT_ID',
      ),
      amount: this.normalizeAmount(input.amount),
      currency: this.normalizeCurrency(input.currency),
      timestamp: this.normalizeTimestamp(input.timestamp),
      description: this.normalizeDescription(input.description),
    };
  }

  private validateNormalized(
    value: NormalizedTransaction,
    raw: unknown,
  ): ValidateResult {
    if (!SUPPORTED_CURRENCIES.has(value.currency)) {
      return this.reject(
        'UNSUPPORTED_CURRENCY',
        `Currency ${value.currency} is not supported`,
        this.limitRaw(raw),
      );
    }

    return { ok: true, value };
  }

  private normalizeRequiredString(
    value: unknown,
    field: string,
    code: RejectionCode,
  ): string {
    if (value === undefined || value === null) {
      throw new NormalizationError('MISSING_FIELD', `${field} is required`);
    }
    if (typeof value !== 'string') {
      throw new NormalizationError(code, `${field} must be a string`);
    }

    const normalized = this.sanitizeString(value);
    if (normalized.length === 0) {
      throw new NormalizationError(code, `${field} must not be empty`);
    }

    return normalized;
  }

  private normalizeAmount(value: unknown): number {
    if (value === undefined || value === null) {
      throw new NormalizationError('MISSING_FIELD', 'amount is required');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new NormalizationError(
        'INVALID_AMOUNT',
        'amount must be a finite number',
      );
    }
    if (value <= 0) {
      throw new NormalizationError(
        'INVALID_AMOUNT',
        'amount must be greater than zero',
      );
    }

    // Persist as Decimal(18, 2); reject values that are not exact to 2 places.
    const cents = value * 100;
    if (Math.abs(cents - Math.round(cents)) > 1e-8) {
      throw new NormalizationError(
        'INVALID_AMOUNT',
        'amount must have at most two decimal places',
      );
    }

    return Math.round(cents) / 100;
  }

  private normalizeCurrency(value: unknown): string {
    if (value === undefined || value === null) {
      throw new NormalizationError('MISSING_FIELD', 'currency is required');
    }
    if (typeof value !== 'string') {
      throw new NormalizationError(
        'INVALID_CURRENCY',
        'currency must be a string',
      );
    }

    const normalized = this.sanitizeString(value).toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new NormalizationError(
        'INVALID_CURRENCY',
        'Currency must be a three-letter code',
      );
    }

    return normalized;
  }

  private normalizeTimestamp(value: unknown): string {
    if (value === undefined || value === null) {
      throw new NormalizationError('MISSING_FIELD', 'timestamp is required');
    }
    if (typeof value !== 'string') {
      throw new NormalizationError(
        'INVALID_TIMESTAMP',
        'timestamp must be a string',
      );
    }

    const trimmed = value.trim();
    if (!ISO_8601_PATTERN.test(trimmed)) {
      throw new NormalizationError(
        'INVALID_TIMESTAMP',
        'timestamp must be a valid ISO-8601 date-time',
      );
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new NormalizationError(
        'INVALID_TIMESTAMP',
        'timestamp must be a valid ISO-8601 date-time',
      );
    }

    // Deterministic UTC representation for fingerprints.
    return parsed.toISOString();
  }

  private normalizeDescription(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new NormalizationError(
        'INVALID_DESCRIPTION',
        'description must be a string when provided',
      );
    }

    const normalized = this.sanitizeString(value);
    if (normalized.length === 0) {
      return null;
    }
    if (normalized.length > MAX_DESCRIPTION_LENGTH) {
      throw new NormalizationError(
        'DESCRIPTION_TOO_LONG',
        `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
      );
    }

    return normalized;
  }

  /**
   * Trim, NFC-normalize, and strip control characters (including null bytes).
   */
  private sanitizeString(value: string): string {
    const normalized = value.normalize('NFC').trim();
    // eslint-disable-next-line no-control-regex -- intentional control-char strip
    return normalized.replace(/[\u0000-\u001F\u007F]/g, '');
  }

  private reject(
    reason: RejectionCode,
    message: string,
    rawValue: unknown,
  ): ValidateResult {
    return {
      ok: false,
      reason,
      message,
      rawValue: this.limitRaw(rawValue),
    };
  }

  private limitRaw(raw: unknown): unknown {
    if (typeof raw === 'string') {
      return raw.length > MAX_RAW_VALUE_CHARS
        ? raw.slice(0, MAX_RAW_VALUE_CHARS)
        : raw;
    }

    try {
      const serialized = JSON.stringify(raw);
      if (serialized === undefined) {
        return null;
      }
      if (serialized.length <= MAX_RAW_VALUE_CHARS) {
        return raw;
      }
      return serialized.slice(0, MAX_RAW_VALUE_CHARS);
    } catch {
      return null;
    }
  }
}

class NormalizationError extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'NormalizationError';
  }
}
