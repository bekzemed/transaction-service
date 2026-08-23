# Risk Worker Pool

Why risk scoring runs on a fixed worker-thread pool — and how the processor uses it.

## The problem

Risk calculation is CPU-heavy. Each score includes a simulated model run (a tight CPU loop) on top of a simple heuristic over amount, time, and currency.

If that work ran on the processor’s main thread, it would block the event loop for seconds at a time on large imports. The handler could not make steady progress on I/O, database writes, or message handling while risk was running.

Worker threads are the right tool here — but only if I use them as a **pool**, not as one new thread per transaction line.

## The decision

I run risk on a **fixed-size pool** of worker threads inside the processor process.

| Piece                        | Role                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| **Risk worker**              | Does the actual calculation off the main thread                           |
| **Worker pool**              | Owns N threads, hands one out per task, queues when all are busy          |
| **Risk calculation service** | Submits a batch of lines to the pool and collects results                 |
| **Handler**                  | Pages lines from the database, scores each page, persists scores, repeats |

Pool size defaults to **machine cores minus two**, so the main thread and I/O still have room. The simulated work duration per line is configurable.

## How the pool works

The pool starts lazily on the first risk task.

For each line:

1. **Acquire** a free worker (or wait until one is returned)
2. **Send** a small plain payload (line id, amount, currency, timestamp)
3. **Wait** for the worker to post back a score
4. **Release** the worker so the next waiting task can use it

If every thread is busy, new tasks wait in a queue instead of spawning more threads. That caps CPU usage and keeps memory predictable.

If a worker crashes or exits, the pool drops it, terminates it, and spawns a replacement so the pool size stays stable.

On shutdown, the pool rejects new work, clears waiters, and terminates all workers cleanly.

## What runs inside a worker

Each worker is a standalone script — no NestJS, no database. It only:

- Receives one task at a time
- Applies the risk heuristic
- Burns CPU for the configured simulation time (standing in for a real model)
- Returns an integer score from 1 to 100

Keeping workers dumb and stateless makes them easy to replace and safe to run in parallel.

## How the handler uses it

Risk runs **after** validation, fingerprinting, and insert. The import file has already been streamed and accepted lines are in the database.

Then:

1. **Fetch** a batch of transaction lines from the database (batch size is configurable; on the order of about 100 lines)
2. **Submit** every line in that batch to the pool at once
3. The pool runs up to N scores in parallel; the rest wait for a free thread
4. **Persist** all scores for that batch
5. **Fetch** the next batch until no lines remain

```
DB page → submit batch to pool → parallel CPU work → bulk update risks → next page
```

I persist each batch before loading the next one so peak memory stays tied to batch size, not total import size.

## Why a pool (not one thread per line)

- **Bounded resources** — a 100k-line file does not create 100k threads
- **Throughput** — several lines score at once without melting the machine
- **Main thread stays responsive** — the processor can still await database calls and manage the job while workers do CPU work
- **Fits the processor split** — validation and I/O stay on the main thread; only the hot CPU path moves to workers

Validation does not need this — it is mostly streaming and cheap checks. Risk does.

## Takeaway

The worker pool is how I keep risk calculation fast without blocking the processor: a fixed number of threads, a borrow-and-return queue, batch submission from the handler, and scores written back in batches. Same rhythm as validation — work in windows, flush, continue — but the heavy step runs off the event loop.
