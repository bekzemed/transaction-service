# Transaction Service

High-throughput transaction import and reconciliation API. The HTTP API and the RabbitMQ processor run as separate Node.js processes. PostgreSQL stores jobs and transaction lines; RabbitMQ carries import work.

## How to run the project

**Prerequisites:** Docker. Node.js 20+ and npm are only needed for host development (option B).

**Option A — API, processor, PostgreSQL, and RabbitMQ in Docker**

```bash
docker compose up --build
```

This applies migrations, then starts the API and processor. The API listens on `http://localhost:3000`. OpenAPI docs are at `http://localhost:3000/docs`. RabbitMQ management UI is at `http://localhost:15672` (`rabbitmq` / `rabbitmq`).

**Option B — API and processor on the host**

```bash
npm install
cp .env.example .env
docker compose up -d postgres rabbitmq
npx prisma generate
npm run migrate:dev
npm run start:dev
```

## How to run migrations

Prisma reads `DATABASE_URL` from `.env`. Generate the client after install or schema changes:

```bash
npx prisma generate
```

Apply migrations:

```bash
# local development (applies pending migrations and regenerates the client)
npm run migrate:dev

# apply already-created migrations without prompting (CI / production)
npm run migrate:deploy

# check whether the database is in sync
npm run migrate:status
```

Create a new migration from schema changes without applying it:

```bash
npm run migrate:create
```

Reset the local database (drops data, reapplies all migrations):

```bash
npm run migrate:reset
```

Browse data with Prisma Studio:

```bash
npm run db:studio
```

## How to generate test data

Generate an NDJSON import fixture under `test-files/`:

```bash
# 1000 records (default)
npm run generate:data

# custom record count
npm run generate:data -- --records=1000
npm run generate:data --records=500000
```

The file is written to `test-files/transactions-<count>.ndjson`. Upload it with:

```bash
curl -X POST http://localhost:3000/v1/imports \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "file=@test-files/transactions-1000.ndjson"
```

Specialized fixtures (unique, duplicates, mixed valid/invalid, large files) can be generated with `npm run generate:manual-tests` if you have a source NDJSON at `~/Downloads/transactions.ndjson`.

## How to start all required processes

Four processes are required: PostgreSQL, RabbitMQ, the API, and the processor.

**Docker (recommended)**

```bash
docker compose up --build
```

The API and processor share an `uploads` volume. Compose waits for PostgreSQL and RabbitMQ to be healthy, runs `prisma migrate deploy`, then starts both Node processes. To run only the databases (for host development):

```bash
docker compose up -d postgres rabbitmq
```

**Host API and processor**

Start both together (recommended):

```bash
npm run start:dev
```

Or start each process in its own terminal:

```bash
npm run start:api:dev
npm run start:processor:dev
```

Other modes:

```bash
# without watch
npm run start

# production (build first)
npm run build
npm run start:prod
```

The API accepts uploads and publishes jobs. The processor consumes `PROCESS_TRANSACTION_JOB` messages, parses NDJSON, persists transaction lines, and scores risk. Both processes must share the same `UPLOADS_DIR` and RabbitMQ settings.

## How to run tests

```bash
# unit tests
npm run test

# watch mode
npm run test:watch

# coverage
npm run test:cov

# e2e tests
npm run test:e2e
```

A concurrent idempotency check against a running API:

```bash
npm run import:concurrent
```

See [docs/concurrent-import-idempotency-test.md](docs/concurrent-import-idempotency-test.md) for details.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. Values in `.env.example` are for host processes talking to Compose PostgreSQL and RabbitMQ on localhost. The API and processor containers get `DATABASE_URL`, `RABBITMQ_URL`, and `UPLOADS_DIR` from `docker-compose.yml` so they use Docker DNS and the shared uploads volume.

| Variable                                   | Default                                   | Description                                                                  |
| ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                             | —                                         | PostgreSQL connection string. Required.                                      |
| `PORT`                                     | `3000`                                    | API listen port.                                                             |
| `RABBITMQ_URL`                             | `amqp://rabbitmq:rabbitmq@localhost:5672` | AMQP connection URL.                                                         |
| `RABBITMQ_IMPORT_EXCHANGE`                 | `import.exchange`                         | Exchange used to publish import jobs.                                        |
| `RABBITMQ_TRANSACTION_QUEUE`               | `transaction.jobs`                        | Queue the processor consumes.                                                |
| `RABBITMQ_PROCESS_TRANSACTION_ROUTING_KEY` | `PROCESS_TRANSACTION_JOB`                 | Routing key for import jobs.                                                 |
| `RABBITMQ_PREFETCH`                        | `5`                                       | Max unacked jobs the processor holds at once.                                |
| `RABBITMQ_CONSUMER_TIMEOUT_MINUTES`        | `60`                                      | Broker consumer acknowledgement timeout.                                     |
| `UPLOADS_DIR`                              | `uploads`                                 | Directory for uploaded NDJSON files. Must be the same for API and processor. |
| `UPLOADS_RETENTION_HOURS`                  | `24`                                      | Age after which unused uploads are deleted. Set `0` to disable the sweeper.  |
| `IMPORT_BATCH_SIZE`                        | `100`                                     | Transaction lines parsed and persisted per batch.                            |
| `IMPORT_MAX_LINE_BYTES`                    | `65536`                                   | Max size of a single NDJSON line.                                            |
| `RISK_BATCH_SIZE`                          | `100`                                     | Transaction lines sent to the risk worker pool per batch.                    |
| `RISK_SIMULATION_MS`                       | `2000`                                    | Simulated CPU work per risk score (milliseconds).                            |
| `MONITORING_INTERVAL_MS`                   | `10000`                                   | Interval for event-loop health logs.                                         |

## Known limitations

1. Cancelled jobs can not be resumed
2. Failed jobs can not be retried
