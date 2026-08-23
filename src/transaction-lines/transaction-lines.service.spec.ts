jest.mock('./transaction-lines.repository', () => ({
  TransactionLinesRepository: jest.fn().mockImplementation(() => ({})),
}));

import { TransactionLinesService } from './transaction-lines.service';
import type { TransactionLinesRepository } from './transaction-lines.repository';

describe('TransactionLinesService', () => {
  const repository = {} as TransactionLinesRepository;
  const service = new TransactionLinesService(repository);

  const valid = {
    transactionId: ' txn-10001 ',
    accountId: 'acc-201',
    merchantId: 'merchant-18',
    amount: 145.75,
    currency: 'usd',
    timestamp: '2026-07-20T10:25:00.000Z',
    description: ' Subscription payment ',
  };

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

  it('rejects unsupported currency after normalizing the code', () => {
    const result = service.validate({ ...valid, currency: 'zzz' }, 'job-1');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.reason).toBe('UNSUPPORTED_CURRENCY');
  });

  it('rejects invalid amount', () => {
    const result = service.validate({ ...valid, amount: 0 }, 'job-1');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.reason).toBe('INVALID_AMOUNT');
  });

  it('rejects non-object records without throwing', () => {
    const result = service.validate(['not', 'an', 'object'], 'job-1');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.reason).toBe('INVALID_RECORD');
  });

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
    expect(service.calculateFingerprint({ ...base, amount: 145.76 })).not.toBe(
      service.calculateFingerprint(base),
    );
  });
});
