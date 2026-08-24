# Fingerprint Field Selection

Why the fingerprint uses only four fields — and how that catches similar-looking transactions.

## The problem

Import files can contain the same payment more than once: retries, overlapping uploads, or lines that differ only in cosmetic fields.

If I keyed uniqueness on every column, or on `transactionId` alone, those near-duplicates would slip through as separate rows. I need a stable identity for “this is the same economic event,” not “this is the same JSON line.”

## The decision

I fingerprint **normalized** values of:

| Field        | Role                                   |
| ------------ | -------------------------------------- |
| `accountId`  | Who paid                               |
| `merchantId` | Who was paid                           |
| `amount`     | How much (fixed to two decimal places) |
| `timestamp`  | When (canonical UTC ISO-8601)          |

Those four values are hashed in that fixed order (SHA-256, null-byte separated). The result is stored uniquely on each transaction line.

## Why these fields

Together they answer the question that matters for duplicate detection: **same payer, same payee, same amount, same moment.**

- **`accountId` + `merchantId`** — without both sides, two different relationships could collide on amount and time alone.
- **`amount`** — the economic size of the event. Fixed to two decimals so `10.5` and `10.50` do not look different after normalization.
- **`timestamp`** — when the event happened. Normalized to UTC ISO so equivalent times with different string formatting still match.

If any one of these changes, the fingerprint changes. That is intentional: a different account, merchant, amount, or time is a different transaction.

## What I leave out

- **`transactionId`** — client-supplied identifiers often change on retry even when the payment is the same. Using it would treat re-imports as new events.
- **`description`** — free text. Wording can differ without changing who paid whom, how much, or when.
- **`currency`** — amount is already normalized in context of the validated record; the four-field set is enough to spot the duplicate shapes this pipeline is meant to catch.

Leaving those out makes the fingerprint focus on substance, not presentation or client-side IDs.

## How it helps

Two lines that “look alike” as the same payment — same account, merchant, amount, and time — produce the same fingerprint even if `transactionId` or `description` differ.

The database then rejects a second insert with that fingerprint (`skipDuplicates` on batch insert). Callers count duplicates as rows attempted minus rows actually written.

## Takeaway

The fingerprint is a compact identity for the payment itself. I hash the four fields that define the event, after normalization, and ignore fields that commonly differ on duplicate or retry submissions.
