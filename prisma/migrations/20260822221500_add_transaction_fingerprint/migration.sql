-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "fingerprint" CHAR(64);

UPDATE "transactions"
SET "fingerprint" = md5("id"::text) || md5("id"::text)
WHERE "fingerprint" IS NULL;

ALTER TABLE "transactions" ALTER COLUMN "fingerprint" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_fingerprint_key" ON "transactions"("fingerprint");
