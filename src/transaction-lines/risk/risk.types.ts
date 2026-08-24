/** Plain-value payload sent to a worker thread (must be structured-cloneable). */
export interface RiskTaskInput {
  transactionLineId: string;
  amount: number;
  currency: string;
  /** Epoch milliseconds — Date objects survive structured clone, but a number keeps the contract explicit. */
  timestampMs: number;
}

export interface RiskResult {
  transactionLineId: string;
  /** Integer risk score in [1, 100]. */
  risk: number;
}

export interface RiskWorkerData {
  /** Duration of the simulated CPU-intensive work per record. */
  simulationMs: number;
}
