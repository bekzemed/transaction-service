-- AlterTable
ALTER TABLE "transaction_lines" ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "transaction_lines_jobId_idx" ON "transaction_lines"("jobId");

-- AddForeignKey
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
