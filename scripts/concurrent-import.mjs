#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_URL = 'http://localhost:3000/v1/imports';
const DEFAULT_FILE = new URL('./fixtures/sample.ndjson', import.meta.url);
const DEFAULT_CONCURRENCY = 5;

function printUsage() {
  console.log(`
Concurrent import request tester

Usage:
  npm run import:concurrent -- [options]

Options:
  --url <url>                 Import endpoint URL (default: ${DEFAULT_URL})
  --file <path>               NDJSON file to upload (default: scripts/fixtures/sample.ndjson)
  --idempotency-key, -k <key> Idempotency-Key header (default: random UUID per run)
  --concurrency, -n <number>  Number of parallel requests (default: ${DEFAULT_CONCURRENCY})
  --help, -h                  Show this help message

Examples:
  npm run import:concurrent
  npm run import:concurrent -- -n 10 -k my-test-key
  npm run import:concurrent -- --file ./uploads/my-file.ndjson --url http://localhost:3001/v1/imports
`);
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    file: DEFAULT_FILE.pathname,
    idempotencyKey: randomUUID(),
    concurrency: DEFAULT_CONCURRENCY,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--url':
        options.url = argv[++i];
        break;
      case '--file':
        options.file = argv[++i];
        break;
      case '--idempotency-key':
      case '-k':
        options.idempotencyKey = argv[++i];
        break;
      case '--concurrency':
      case '-n': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 1) {
          throw new Error('concurrency must be a positive integer');
        }
        options.concurrency = value;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function sendImportRequest({ url, filePath, idempotencyKey, requestIndex }) {
  const startedAt = performance.now();
  const fileBuffer = readFileSync(filePath);
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/x-ndjson' });

  form.append('file', blob, basename(filePath));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: form,
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const bodyText = await response.text();
    let body;

    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }

    return {
      requestIndex,
      ok: response.ok,
      status: response.status,
      durationMs,
      body,
    };
  } catch (error) {
    return {
      requestIndex,
      ok: false,
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const filePath = resolve(options.file);

  console.log('Concurrent import test');
  console.log(`  URL:              ${options.url}`);
  console.log(`  File:             ${filePath}`);
  console.log(`  Idempotency-Key:  ${options.idempotencyKey}`);
  console.log(`  Concurrency:      ${options.concurrency}`);
  console.log('');

  const results = await Promise.all(
    Array.from({ length: options.concurrency }, (_, index) =>
      sendImportRequest({
        url: options.url,
        filePath,
        idempotencyKey: options.idempotencyKey,
        requestIndex: index + 1,
      }),
    ),
  );

  for (const result of results) {
    const jobId = result.body?.id ?? 'n/a';
    const status = result.body?.status ?? 'n/a';
    const errorSuffix = result.error ? ` error=${result.error}` : '';

    console.log(
      `#${result.requestIndex}  HTTP ${result.status}  ${result.durationMs}ms  id=${jobId}  status=${status}${errorSuffix}`,
    );
  }

  const successful = results.filter((result) => result.ok);
  const jobIds = successful
    .map((result) => result.body?.id)
    .filter((id) => typeof id === 'string');
  const uniqueJobIds = new Set(jobIds);

  console.log('');
  console.log('Summary');
  console.log(`  Successful requests: ${successful.length}/${results.length}`);
  console.log(`  Unique job IDs:      ${uniqueJobIds.size}`);
  console.log(
    `  Idempotency check:    ${uniqueJobIds.size <= 1 ? 'PASS (same job returned)' : 'FAIL (multiple jobs created)'}`,
  );

  if (uniqueJobIds.size > 0) {
    console.log(`  Job ID(s):           ${[...uniqueJobIds].join(', ')}`);
  }

  if (successful.length !== results.length || uniqueJobIds.size > 1) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  printUsage();
  process.exit(1);
});
