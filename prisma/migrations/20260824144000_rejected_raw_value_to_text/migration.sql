-- AlterTable
ALTER TABLE "rejected_transaction_lines"
ALTER COLUMN "rawValue" TYPE TEXT
USING (
  CASE
    WHEN jsonb_typeof("rawValue") = 'string' THEN "rawValue" #>> '{}'
    ELSE "rawValue"::text
  END
);
