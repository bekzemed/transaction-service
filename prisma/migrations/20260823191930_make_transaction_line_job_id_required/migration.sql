/*
  Warnings:

  - Made the column `jobId` on table `transaction_lines` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transaction_lines" DROP CONSTRAINT "transaction_lines_jobId_fkey";

-- Remove pre-jobId rows that cannot satisfy the new required FK.
DELETE FROM "transaction_lines" WHERE "jobId" IS NULL;

-- AlterTable
ALTER TABLE "transaction_lines" ALTER COLUMN "jobId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
