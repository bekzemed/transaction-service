-- Composite indexes matching GET /v1/imports/:id/summary:
-- GROUP BY currency / merchantId / accountId filtered by jobId,
-- and COUNT(*) filtered by jobId + risk range.
CREATE INDEX "transaction_lines_jobId_currency_idx" ON "transaction_lines"("jobId", "currency");
CREATE INDEX "transaction_lines_jobId_merchantId_idx" ON "transaction_lines"("jobId", "merchantId");
CREATE INDEX "transaction_lines_jobId_accountId_idx" ON "transaction_lines"("jobId", "accountId");
CREATE INDEX "transaction_lines_jobId_risk_idx" ON "transaction_lines"("jobId", "risk");
