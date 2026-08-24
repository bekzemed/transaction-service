#!/usr/bin/env node
/**
 * Generates an NDJSON import fixture under test-files/.
 *
 * Usage:
 *   npm run generate:data --records=500000
 *   npm run generate:data -- --records=1000
 */
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'test-files');

const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'CNY',
  'HKD',
  'NZD',
];

function parseRecords() {
  const equalsArg = process.argv.find((arg) => arg.startsWith('--records='));
  const flagIndex = process.argv.indexOf('--records');
  const spacedArg = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  const raw =
    equalsArg?.slice('--records='.length) ??
    spacedArg ??
    process.env.npm_config_records ??
    '1000';

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('records must be a positive integer');
  }

  return value;
}

function recordAt(index) {
  const cents = 1000 + (index % 99_000);
  return {
    transactionId: `txn-${String(index).padStart(7, '0')}`,
    accountId: `acc-${(index % 5000) + 1}`,
    merchantId: `merchant-${(index % 200) + 1}`,
    amount: cents / 100,
    currency: CURRENCIES[index % CURRENCIES.length],
    timestamp: new Date(Date.UTC(2026, 6, 20, 10, 0, 0) + index).toISOString(),
    description: `Payment ${index}`,
  };
}

async function writeRecords(path, count) {
  const stream = createWriteStream(path);

  for (let i = 1; i <= count; i += 1) {
    const canContinue = stream.write(`${JSON.stringify(recordAt(i))}\n`);
    if (!canContinue) {
      await once(stream, 'drain');
    }
  }

  stream.end();
  await finished(stream);
}

async function main() {
  const records = parseRecords();
  mkdirSync(OUT_DIR, { recursive: true });

  const filename = `transactions-${records}.ndjson`;
  const path = join(OUT_DIR, filename);
  await writeRecords(path, records);

  console.log(`Wrote ${records} records to ${path}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
