-- Convert existing 0–1 scores to 1–100 integers before changing the type.
ALTER TABLE "transaction_lines"
  ALTER COLUMN "risk" SET DATA TYPE INTEGER
  USING CASE
    WHEN "risk" IS NULL THEN NULL
    ELSE GREATEST(1, LEAST(100, ROUND("risk" * 100)::integer))
  END;
