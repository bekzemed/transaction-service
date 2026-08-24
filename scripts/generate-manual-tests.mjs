#!/usr/bin/env node
/**
 * Generates NDJSON fixtures under manual-test/.
 *
 * Source file (Downloads/transactions.ndjson) has 5,000 lines. The 100k
 * performance fixture is expanded from that pattern with unique transactionIds.
 *
 * Usage:
 *   node scripts/generate-manual-tests.mjs
 *   node scripts/generate-manual-tests.mjs --source=/path/to/transactions.ndjson
 */
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'manual-test');

const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const SOURCE =
  sourceArg?.slice('--source='.length) ??
  join(process.env.HOME ?? '', 'Downloads/transactions.ndjson');

function parseLines(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function writeLines(path, lines) {
  const stream = createWriteStream(path);
  for (const line of lines) {
    stream.write(
      `${typeof line === 'string' ? line : JSON.stringify(line)}\n`,
    );
  }
  stream.end();
  return finished(stream);
}

function cloneWithId(record, transactionId) {
  return { ...record, transactionId };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const source = parseLines(SOURCE);
  if (source.length === 0) {
    throw new Error(`No records found in ${SOURCE}`);
  }

  // 1) 1000 unique — first 1000 from source (already unique txn ids)
  const unique1000 = source.slice(0, 1000).map((r, i) =>
    cloneWithId(r, `txn-unique-${String(i + 1).padStart(5, '0')}`),
  );
  await writeLines(join(OUT_DIR, '1000-unique.ndjson'), unique1000);

  // 2) 1000 with duplicates — 700 unique + 300 repeats of earlier rows
  const withDupes = [];
  for (let i = 0; i < 700; i += 1) {
    withDupes.push(
      cloneWithId(source[i % source.length], `txn-dupbase-${String(i + 1).padStart(5, '0')}`),
    );
  }
  for (let i = 0; i < 300; i += 1) {
    // Exact copies of earlier lines → same transactionId + fingerprint
    withDupes.push({ ...withDupes[i] });
  }
  await writeLines(join(OUT_DIR, '1000-with-duplicates.ndjson'), withDupes);

  // 3) 1000 mixed — valid, duplicates, and invalid formats
  const mixed = [];
  for (let i = 0; i < 600; i += 1) {
    mixed.push(
      cloneWithId(source[i % source.length], `txn-mixed-${String(i + 1).padStart(5, '0')}`),
    );
  }
  // 150 duplicates of the first 150 valids
  for (let i = 0; i < 150; i += 1) {
    mixed.push({ ...mixed[i] });
  }
  // 250 invalid / malformed lines
  const invalids = [
    '', // empty
    '{not-json',
    JSON.stringify({ transactionId: 'bad-1' }), // missing fields
    JSON.stringify({
      transactionId: 'bad-amount',
      accountId: 'acc-1',
      merchantId: 'm-1',
      amount: -5,
      currency: 'USD',
      timestamp: '2026-07-20T10:25:00.000Z',
    }),
    JSON.stringify({
      transactionId: 'bad-currency-format',
      accountId: 'acc-1',
      merchantId: 'm-1',
      amount: 10.5,
      currency: 'US',
      timestamp: '2026-07-20T10:25:00.000Z',
    }),
    JSON.stringify({
      transactionId: 'bad-currency-unsupported',
      accountId: 'acc-1',
      merchantId: 'm-1',
      amount: 10.5,
      currency: 'ZZZ',
      timestamp: '2026-07-20T10:25:00.000Z',
    }),
    JSON.stringify({
      transactionId: 'bad-timestamp',
      accountId: 'acc-1',
      merchantId: 'm-1',
      amount: 10.5,
      currency: 'USD',
      timestamp: 'not-a-date',
    }),
    JSON.stringify({
      transactionId: 'bad-desc',
      accountId: 'acc-1',
      merchantId: 'm-1',
      amount: 10.5,
      currency: 'USD',
      timestamp: '2026-07-20T10:25:00.000Z',
      description: 'x'.repeat(501),
    }),
    '[]',
    '"just-a-string"',
  ];
  for (let i = 0; i < 250; i += 1) {
    mixed.push(invalids[i % invalids.length]);
  }
  await writeLines(join(OUT_DIR, '1000-mixed-invalid-duplicates.ndjson'), mixed);

  // 4) 500,000 performance — expand source with unique ids / fingerprints
  const perfPath = join(OUT_DIR, '500000-performance.ndjson');
  const perfStream = createWriteStream(perfPath);
  const TARGET = 500_000;
  for (let i = 0; i < TARGET; i += 1) {
    const base = source[i % source.length];
    const row = cloneWithId(
      base,
      `txn-perf-${String(i + 1).padStart(6, '0')}`,
    );
    // Unique fingerprint: shift timestamp by i ms (amount alone isn't enough at this scale)
    row.timestamp = new Date(
      new Date(base.timestamp).getTime() + i,
    ).toISOString();
    perfStream.write(`${JSON.stringify(row)}\n`);
  }
  perfStream.end();
  await finished(perfStream);

  console.log(`Wrote fixtures to ${OUT_DIR}`);
  console.log('  1000-unique.ndjson');
  console.log('  1000-with-duplicates.ndjson');
  console.log('  1000-mixed-invalid-duplicates.ndjson');
  console.log('  500000-performance.ndjson  (expanded from 5k source)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
