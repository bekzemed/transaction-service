# Message Handler Architecture

Why transaction processing lives in its own process, and how that keeps the API responsive.

## The problem

When a client uploads a large NDJSON file, the work after the upload is heavy: validate every line, detect duplicates, then calculate risk.

If that work ran inside the same Node.js process as the HTTP API, long import jobs would compete with live requests for the same event loop. API latency would suffer whenever a big file was being processed.

## The decision

I split the app into **two processes on the same machine**:

| Process       | Role                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| **API**       | Accepts HTTP requests, stores the file, creates the job, publishes a message |
| **Processor** | Consumes that message and runs the full transaction pipeline                 |

Both share the same codebase and the same Postgres / RabbitMQ / uploads disk. They do not share an event loop.

```
Client → API → store file + create job → RabbitMQ → Processor → validate → (later) fingerprint / risk
```

## Why a separate process (not just worker threads)

The first alternative I considered was to keep one process and offload validation to worker threads so the API stays responsive.

Worker threads help with CPU-heavy work, but they do not fully isolate the API. The main thread still owns the database, job state, and message acknowledgment — so results still have to come back across that same loop that serves HTTP.

A **process boundary** removes that coupling entirely:

- Whatever the processor does to its own event loop never touches API response time
- Validation can stay simple (stream the file, parse and validate in batches) without special thread plumbing
- The API only publishes; the processor only consumes — no accidental shared consumers on the same queue

That makes the split a better fit for an event-driven system running on a **single physical machine**: I get isolation and clearer ownership without needing multiple hosts yet.

## What the message handler does today

The processor listens for import-job messages. Each message points at a job and the uploaded file to process.

Today the handler focuses on **validation and normalization**:

1. Stream the file line by line
2. Validate and normalize each transaction in batches
3. Track progress counts (processed / rejected; accepted and duplicates come in later stages)
4. Hand valid rows to the next pipeline step

Later stages (fingerprint, duplicate detection, risk) plug into the same handler pipeline.

## Why this also helps risk calculation

Risk scoring is CPU-intensive and is a natural fit for a **worker thread pool** inside the processor.

Because risk already runs away from the API process:

- The pool can use machine cores without competing with HTTP traffic
- I can size the pool for throughput on one box (fixed workers, not one thread per transaction)
- Scaling the event-driven path becomes: tune the processor (prefetch, batch size, worker pool), not overload the API

So the same split that protects validation also sets me up to scale risk work cleanly on a single host.

## Takeaway

Two processes, one machine: the API stays fast for clients; the processor owns the queue and the heavy pipeline. That isolation is the right foundation for validation now and for worker-pool risk calculation as the event-driven path grows.
