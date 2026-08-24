DROP INDEX IF EXISTS "cancellation_requests_jobId_idx";

CREATE UNIQUE INDEX "cancellation_requests_jobId_key" ON "cancellation_requests"("jobId");
