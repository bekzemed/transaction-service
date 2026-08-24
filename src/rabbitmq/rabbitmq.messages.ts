import { isStorageKey } from '../storage/file-storage.service';

/**
 * Wire contract between the API process (publisher) and the processor process
 * (consumer). It carries a storage key rather than an upload descriptor so the
 * consumer resolves the file against its own configured uploads root.
 */
export interface ProcessTransactionJobMessage {
  jobId: string;
  storageKey: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a decoded queue payload against the wire contract.
 *
 * A message reaching the consumer is untrusted: anything with queue access can
 * publish, so the payload is checked before it is logged or acted on. This
 * covers the wire shape only — `FileStorageService.resolvePath` stays the
 * authority on which storage keys are safe to touch on disk.
 */
export function isProcessTransactionJobMessage(
  value: unknown,
): value is ProcessTransactionJobMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const { jobId, storageKey } = value as Record<string, unknown>;

  return (
    typeof jobId === 'string' &&
    UUID_PATTERN.test(jobId) &&
    typeof storageKey === 'string' &&
    isStorageKey(storageKey)
  );
}
