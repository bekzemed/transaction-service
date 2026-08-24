# Checkpoint Cancellation

Why import jobs stop at batch boundaries — and how a cancellation request reaches the processor without aborting mid-work.

## The problem

An import can run for a long time: stream the file, validate in batches, persist accepted lines, then page through those lines to score risk.

The client needs a way to stop that work safely.

## How it's handled

Cancelling a running job is a 2 step process:

1. Store a cancellation request or intent on the database
2. Have breakpoints in the job handler to check if a cancellation is requested and perform safe cancellations

### 1. How the API records intent

`POST /v1/imports/:id/cancel` is allowed only while the job is `pending` or `processing`.

1. Load the job (404 if missing)
2. Reject with 400 if status is anything else (`cancelling`, `cancelled`, `completed`, `failed`)
3. Create a `CancellationRequest` for that job (optional `reason`)
4. Set job status to `cancelling`
5. Return 202 with the request id, job id, reason, and created-at

The request row is the source of truth the processor polls. Status `cancelling` is what the client sees in the meantime.

If a request already exists for the job, creating another is a no-op at the service layer — the existing row is returned. In practice the status check runs first, so a second HTTP cancel after the job is already `cancelling` is rejected.

### 2. Where the job handler checks

The handler never interrupts a batch that has already started. It polls **before** the next unit of work.

**Validation.** The file is streamed into batches. Before each full batch (and before the leftover remainder) the handler asks: is there a cancellation request for this job?

- **No** — validate the batch, bulk-insert passed rows, update in-memory counts, continue.
- **Yes** — persist `cancelled`, `completedAt`, and the progress counts so far. Return. Lines already in the in-memory batch are dropped, not written.

**Risk.** After validation, counts are flushed to the job. Risk then pages transaction lines. Before each page:

- **No** — fetch the page, score it on the worker pool, persist scores, continue.
- **Yes** — persist `cancelled` and `completedAt`. Return. Scores already written for earlier pages stay.

```
stream → [checkpoint] → validate+insert batch → … → flush counts
      → [checkpoint] → score+update risk page → … → completed
```

A job cancelled before the processor even starts still hits the first checkpoint after up to one batch of lines has been read into memory. That is the coarsest delay: one validation batch, or one risk page.

## Takeaway

The API records a cancellation request and flips the job to `cancelling`. The processor notices at the next validation or risk checkpoint, marks the job `cancelled` with whatever progress it already has, and returns so the queue message is acked. Stop is cooperative and bounded by batch size — consistent batches over an instant kill.
