-- Replace jobId composites with a standalone risk index.
-- jobId-only lookups continue to use transaction_lines_jobId_idx.
DROP INDEX IF EXISTS "transaction_lines_jobId_currency_idx";
DROP INDEX IF EXISTS "transaction_lines_jobId_merchantId_idx";
DROP INDEX IF EXISTS "transaction_lines_jobId_accountId_idx";
DROP INDEX IF EXISTS "transaction_lines_jobId_risk_idx";

CREATE INDEX "transaction_lines_risk_idx" ON "transaction_lines"("risk");
