-- Rename table to avoid clashing with Prisma Client's transaction API naming.
ALTER TABLE "transactions" RENAME TO "transaction_lines";

ALTER INDEX "transactions_pkey" RENAME TO "transaction_lines_pkey";
ALTER INDEX "transactions_transactionId_key" RENAME TO "transaction_lines_transactionId_key";
ALTER INDEX "transactions_fingerprint_key" RENAME TO "transaction_lines_fingerprint_key";
ALTER INDEX "transactions_accountId_idx" RENAME TO "transaction_lines_accountId_idx";
ALTER INDEX "transactions_merchantId_idx" RENAME TO "transaction_lines_merchantId_idx";
ALTER INDEX "transactions_currency_idx" RENAME TO "transaction_lines_currency_idx";
