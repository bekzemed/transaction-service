# Summary Aggregation

How the import summary is built on read — and the trade-offs behind that approach.

## The problem

After an import finishes, the API needs a reconciliation view: how many lines were accepted, rejected, or duplicated, plus breakdowns by currency, risk level, merchant, and account.

That can mean scanning tens or hundreds of thousands of transaction lines. I did not want every summary request to load all rows into the application and aggregate in memory.

## The decision

I compute the summary **at request time in the database**, scoped to one import job.

| Section                                       | Source                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| **Totals** (accepted / rejected / duplicates) | Counters on the job record                                   |
| **By currency**                               | `GROUP BY` currency — count and sum of amount                |
| **By merchant**                               | `GROUP BY` merchant — count only                             |
| **By account**                                | `GROUP BY` account — count only                              |
| **By risk level**                             | Three `COUNT` queries over risk ranges (low / medium / high) |

The service runs these queries **in parallel** and maps the results into a single response object.

```
GET summary → read job totals + 6 parallel aggregations on transaction_lines → shape response
```

## Why aggregate in the database

- **Memory stays flat** — Postgres returns small result sets (one row per currency, merchant, or account), not every line.
- **Always current** — no separate summary table to keep in sync when lines are inserted or risk is updated.
- **Simple pipeline** — the processor writes lines; the API reads aggregates. No extra write path for summary maintenance.

The job counters for totals are the one exception: those are updated during import processing so the headline numbers are a cheap read, not a full recount.

## Indexes

`transaction_lines` is filtered by `jobId` on every summary query, so a single `jobId` index is enough to find the job’s rows. A separate `risk` index supports the three risk-range counts.

## Trade-offs

### Compute on read vs pre-computed summary

**Chosen:** aggregate from `transaction_lines` when the summary endpoint is called.

**Upside:** no duplicate storage, no invalidation logic, breakdowns always reflect what is in the database.

**Downside:** summary latency grows with import size. Very large jobs pay more per request than a pre-built summary row would.

For this service, read frequency is low compared to the one-time import cost, so on-read aggregation is the simpler fit.

### Job counters vs recounting totals

**Chosen:** accepted / rejected / duplicates come from the job row; breakdowns come from SQL.

**Upside:** totals are O(1). The client gets consistent headline numbers with the status endpoint.

**Downside:** totals only stay correct if the processor updates job counters faithfully during import. Breakdowns are derived independently from stored lines.

### Parallel queries vs one big query

**Chosen:** six queries via `Promise.allSettled` (three group-bys, three risk counts).

**Upside:** lower end-to-end latency than running them one after another; each query stays small and easy to reason about.

**Downside:** more concurrent load on the database for a single API call. Acceptable here because there's only a small or limited number of concurrent calls.

## Measured performance

Timed `GET /v1/imports/:id/summary` against a completed 500,000-line import (`accepted: 500000`, `rejected: 0`, `duplicates: 0`). Response payload was ~32 KB (5 currencies, 100 merchants, 550 accounts).

| Run | Total  | TTFB   |
| --- | ------ | ------ |
| 1   | 130 ms | 129 ms |
| 2   | 82 ms  | 82 ms  |
| 3   | 67 ms  | 67 ms  |
| 4   | 66 ms  | 66 ms  |
| 5   | 62 ms  | 62 ms  |
| 6   | 61 ms  | 61 ms  |

After first request, latency stayed in the **61–82 ms** range (median ~66 ms).

## Takeaway

The summary is built by combining cheap job counters with parallel, indexed SQL aggregations over transaction lines. I favor correctness and simplicity over a pre-materialized summary table — at the cost of heavier reads on very large imports and a burst of parallel queries per request.
