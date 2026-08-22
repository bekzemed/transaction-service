/**
 * Wire contract between the API process (publisher) and the processor process
 * (consumer). It carries a storage key rather than an upload descriptor so the
 * consumer resolves the file against its own configured uploads root.
 */
export interface ProcessTransactionJobMessage {
  jobId: string;
  storageKey: string;
}
