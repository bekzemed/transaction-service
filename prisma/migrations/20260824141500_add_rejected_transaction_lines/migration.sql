-- CreateTable
CREATE TABLE "rejected_transaction_lines" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rawValue" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejected_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rejected_transaction_lines_jobId_idx" ON "rejected_transaction_lines"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "rejected_transaction_lines_jobId_lineNumber_key" ON "rejected_transaction_lines"("jobId", "lineNumber");

-- AddForeignKey
ALTER TABLE "rejected_transaction_lines" ADD CONSTRAINT "rejected_transaction_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
