import { createStorageKey } from '../storage/file-storage.service';
import { isProcessTransactionJobMessage } from './rabbitmq.messages';

describe('isProcessTransactionJobMessage', () => {
  const valid = {
    jobId: 'f6a7f6de-6a52-4c4e-9d5e-df6a2f9b57a1',
    storageKey: createStorageKey('.ndjson'),
  };

  it('accepts a well-formed payload', () => {
    expect(isProcessTransactionJobMessage(valid)).toBe(true);
  });

  it('rejects a traversal-shaped storage key', () => {
    expect(
      isProcessTransactionJobMessage({
        ...valid,
        storageKey: '../etc/passwd',
      }),
    ).toBe(false);
  });

  it('rejects a non-UUID job id, including one with a newline', () => {
    expect(
      isProcessTransactionJobMessage({
        ...valid,
        jobId: 'not-a-uuid',
      }),
    ).toBe(false);
    expect(
      isProcessTransactionJobMessage({
        ...valid,
        jobId: `${valid.jobId}\nERROR forged`,
      }),
    ).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isProcessTransactionJobMessage(null)).toBe(false);
    expect(isProcessTransactionJobMessage('payload')).toBe(false);
  });
});
