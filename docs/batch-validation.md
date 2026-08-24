# Batch Validation

Why validation and database writes run in batches — and how that keeps large imports practical.

## The problem

Import files can be hundreds of thousands of lines. Two naive approaches both hurt:

- **Validate and hold everything, then write once** — peak memory grows with file size. A large NDJSON upload can exhaust the process before a single row is saved.
- **Validate and write one line at a time** — each row becomes its own database round trip. Throughput collapses under network and query overhead.

I needed a middle path: stream the file, work on a small window of lines, flush that window, then continue.

## The decision

The handler streams the file line by line and accumulates a **batch** (default size configurable; currently on the order of about 500 lines).

When the batch is full (and once more for any remainder):

1. **Validate** each line in the batch (normalize inside validation)
2. **Split** outcomes into passed vs rejected
3. **Write** passed rows to the database in one bulk insert
4. **Clear** the batch and keep streaming

```
file stream → fill batch → validate batch → bulk insert passed → clear → repeat
```

Job progress counts (processed, accepted, rejected, duplicates) are updated from each batch’s outcomes.

## Why batches help performance

- **Memory stays bounded** — peak usage tracks batch size, not file size. Clearing the batch after each flush keeps the working set small.
- **Fewer database round trips** — one `createMany`-style insert per batch instead of one insert per line. That is usually the biggest win on large files.
- **Natural backpressure** — the stream only advances after the batch flush finishes, so the reader does not race ahead of the database.
- **Duplicate handling stays cheap** — the bulk insert can skip duplicate fingerprints in the same call; duplicates are counted as attempted minus actually inserted.

Validation itself stays simple and synchronous inside the batch. The expensive part to amortize is I/O to Postgres, not the per-line checks.

## What happens inside a batch

For each line in the batch:

- Empty or oversized lines are rejected immediately
- Invalid JSON is rejected
- Valid JSON goes through normalize-then-validate

Rejected lines never hit the insert. Passed lines are fingerprinted and written together. Later pipeline stages (risk, and so on) can plug into the same batch rhythm.

## Takeaway

Batching is how the handler stays both memory-safe and fast: stream the file, validate a window of lines, write that window once, repeat until the file is done.
