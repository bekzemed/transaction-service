import { Test } from '@nestjs/testing';
import { MAX_DESCRIPTION_LENGTH } from './transaction-line.constants';
import type { RejectionCode } from './transaction-line.types';
import { TransactionLinesRepository } from './transaction-lines.repository';
import { TransactionLinesService } from './transaction-lines.service';

describe('TransactionLinesService', () => {
  let service: TransactionLinesService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionLinesService,
        { provide: TransactionLinesRepository, useValue: {} },
      ],
    }).compile();

    service = module.get(TransactionLinesService);
  });

  const valid = {
    transactionId: ' txn-10001 ',
    accountId: 'acc-201',
    merchantId: 'merchant-18',
    amount: 145.75,
    currency: 'usd',
    timestamp: '2026-07-20T10:25:00.000Z',
    description: ' Subscription payment ',
  };

  function expectRejected(raw: unknown, reason: RejectionCode): void {
    const result = service.validate(raw, 'job-1');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.reason).toBe(reason);
  }

  describe('normalization', () => {
    it('trims strings, uppercases currency, and NFC-normalizes text', () => {
      const decomposed = 'cafe\u0301';
      const result = service.validate(
        {
          ...valid,
          transactionId: `\t${decomposed}\n`,
          accountId: ' acc-201 ',
          merchantId: ' merchant-18 ',
          currency: ' eur ',
          description: `  ${decomposed}  `,
        },
        'job-1',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.transactionId).toBe('café');
      expect(result.value.accountId).toBe('acc-201');
      expect(result.value.merchantId).toBe('merchant-18');
      expect(result.value.currency).toBe('EUR');
      expect(result.value.description).toBe('café');
    });

    it('strips control characters including null bytes', () => {
      const result = service.validate(
        {
          ...valid,
          transactionId: 'txn-\u000010001',
          description: 'pay\u0007ment',
        },
        'job-1',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.transactionId).toBe('txn-10001');
      expect(result.value.description).toBe('payment');
    });

    it('rewrites timestamps to a deterministic UTC ISO-8601 form', () => {
      const result = service.validate(
        { ...valid, timestamp: '2026-07-20T13:25:00+03:00' },
        'job-1',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.timestamp).toBe('2026-07-20T10:25:00.000Z');
    });

    it('rounds amounts that are exact to two decimal places', () => {
      const result = service.validate({ ...valid, amount: 145.75 }, 'job-1');

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.amount).toBe(145.75);
    });

    it('treats a missing or blank description as null', () => {
      const omitted = service.validate(
        {
          transactionId: valid.transactionId,
          accountId: valid.accountId,
          merchantId: valid.merchantId,
          amount: valid.amount,
          currency: valid.currency,
          timestamp: valid.timestamp,
        },
        'job-1',
      );
      const blank = service.validate({ ...valid, description: '   ' }, 'job-1');

      expect(omitted.ok).toBe(true);
      expect(blank.ok).toBe(true);
      if (!omitted.ok || !blank.ok) {
        return;
      }

      expect(omitted.value.description).toBeNull();
      expect(blank.value.description).toBeNull();
    });
  });

  describe('validation', () => {
    it('normalizes and accepts a valid transaction', () => {
      const result = service.validate(valid, 'job-1');

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value).toEqual({
        jobId: 'job-1',
        transactionId: 'txn-10001',
        accountId: 'acc-201',
        merchantId: 'merchant-18',
        amount: 145.75,
        currency: 'USD',
        timestamp: '2026-07-20T10:25:00.000Z',
        description: 'Subscription payment',
      });
    });

    it('rejects non-object records without throwing', () => {
      expectRejected(['not', 'an', 'object'], 'INVALID_RECORD');
      expectRejected(null, 'INVALID_RECORD');
      expectRejected('line', 'INVALID_RECORD');
    });

    it('rejects missing required fields', () => {
      expectRejected({ ...valid, transactionId: undefined }, 'MISSING_FIELD');
      expectRejected({ ...valid, accountId: undefined }, 'MISSING_FIELD');
      expectRejected({ ...valid, merchantId: undefined }, 'MISSING_FIELD');
      expectRejected({ ...valid, amount: undefined }, 'MISSING_FIELD');
      expectRejected({ ...valid, currency: undefined }, 'MISSING_FIELD');
      expectRejected({ ...valid, timestamp: undefined }, 'MISSING_FIELD');
    });

    it('rejects empty identifiers after sanitization', () => {
      expectRejected(
        { ...valid, transactionId: '   ' },
        'INVALID_TRANSACTION_ID',
      );
      expectRejected({ ...valid, accountId: '\u0000' }, 'INVALID_ACCOUNT_ID');
      expectRejected({ ...valid, merchantId: 18 }, 'INVALID_MERCHANT_ID');
    });

    it('rejects invalid amounts', () => {
      expectRejected({ ...valid, amount: 0 }, 'INVALID_AMOUNT');
      expectRejected({ ...valid, amount: -1 }, 'INVALID_AMOUNT');
      expectRejected({ ...valid, amount: Number.NaN }, 'INVALID_AMOUNT');
      expectRejected(
        { ...valid, amount: Number.POSITIVE_INFINITY },
        'INVALID_AMOUNT',
      );
      expectRejected({ ...valid, amount: '145.75' }, 'INVALID_AMOUNT');
      expectRejected({ ...valid, amount: 145.751 }, 'INVALID_AMOUNT');
    });

    it('rejects malformed currency codes before the allowlist check', () => {
      expectRejected({ ...valid, currency: 'US' }, 'INVALID_CURRENCY');
      expectRejected({ ...valid, currency: 'USDD' }, 'INVALID_CURRENCY');
      expectRejected({ ...valid, currency: 840 }, 'INVALID_CURRENCY');
    });

    it('rejects unsupported currency after normalizing the code', () => {
      expectRejected({ ...valid, currency: 'zzz' }, 'UNSUPPORTED_CURRENCY');
    });

    it('rejects invalid timestamps', () => {
      expectRejected(
        { ...valid, timestamp: '2026-07-20' },
        'INVALID_TIMESTAMP',
      );
      expectRejected(
        { ...valid, timestamp: '20/07/2026 10:25:00' },
        'INVALID_TIMESTAMP',
      );
      expectRejected(
        { ...valid, timestamp: 1753007100000 },
        'INVALID_TIMESTAMP',
      );
    });

    it('rejects a non-string or oversized description', () => {
      expectRejected({ ...valid, description: 12 }, 'INVALID_DESCRIPTION');
      expectRejected(
        { ...valid, description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) },
        'DESCRIPTION_TOO_LONG',
      );
    });

    it('accepts a description at the maximum length', () => {
      const result = service.validate(
        { ...valid, description: 'x'.repeat(MAX_DESCRIPTION_LENGTH) },
        'job-1',
      );

      expect(result.ok).toBe(true);
    });
  });

  describe('fingerprints', () => {
    it('calculates a deterministic fingerprint from the four fields in order', () => {
      const first = service.calculateFingerprint({
        accountId: 'acc-201',
        merchantId: 'merchant-18',
        amount: 145.75,
        timestamp: '2026-07-20T10:25:00.000Z',
      });
      const second = service.calculateFingerprint({
        accountId: 'acc-201',
        merchantId: 'merchant-18',
        amount: 145.75,
        timestamp: '2026-07-20T10:25:00.000Z',
      });

      expect(first).toBe(second);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
    });

    it('changes the fingerprint when any of the four fields change', () => {
      const base = {
        accountId: 'acc-201',
        merchantId: 'merchant-18',
        amount: 145.75,
        timestamp: '2026-07-20T10:25:00.000Z',
      };

      expect(
        service.calculateFingerprint({ ...base, accountId: 'acc-other' }),
      ).not.toBe(service.calculateFingerprint(base));
      expect(
        service.calculateFingerprint({ ...base, amount: 145.76 }),
      ).not.toBe(service.calculateFingerprint(base));
    });
  });
});
