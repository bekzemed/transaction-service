<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

Starts the API and the transaction processor together:

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode (build first)
$ npm run build
$ npm run start:prod
```

Run either process alone with `npm run start:api:dev` or `npm run start:processor:dev`.

## Event loop monitoring

Both the API process and the processor process log Node.js event-loop health on a timer (default 10 seconds; override with `MONITORING_INTERVAL_MS`). Metrics are logs only — there is no `/metrics` HTTP endpoint, so scraping does not compete with latency-sensitive routes.

Each line includes:

- **Event-loop delay** (`mean`, `p50`, `p99`, `max` in milliseconds) from `perf_hooks.monitorEventLoopDelay()`
- **Event-loop utilization** for the sampling window from `performance.eventLoopUtilization()`
- **Process CPU usage** as a percentage of one core from `process.cpuUsage()` (can exceed 100% when worker threads use other cores)
- **Heap usage** (`heapUsedBytes`, `heapTotalBytes`) and **RSS** from `process.memoryUsage()`

### How event-loop blocking is detected

`monitorEventLoopDelay()` schedules a timer at a 20 ms resolution and records how late it fires. If the main thread is busy with synchronous work, that timer runs late and delay `p99` / `max` rise. Event-loop utilization approaching `1.0` in the same window confirms the loop spent almost all of its time in JavaScript rather than idle.

### Thresholds that may indicate a problem

These are starting points, not hard alerts. Look for values that stay elevated across several samples, not a single spike.

| Signal | Warning | Problem |
| --- | --- | --- |
| Delay p99 | > 50 ms | > 100 ms |
| Delay max | > 100 ms | > 250 ms |
| Event-loop utilization | > 0.7 | > 0.9 |
| CPU percent (main-thread bound) | high together with high utilization | ~100%+ together with high delay |
| Heap | `heapUsed` climbing toward `heapTotal` | repeated growth after GC, or RSS rising without bound |

Idle delay of ~20 ms is expected because that is the histogram resolution.

### CPU saturation vs downstream I/O latency

**CPU saturation** shows up as high `cpuPercent` *and* high event-loop utilization / delay. The process is busy executing JavaScript (or, on the processor, worker-thread risk scoring that still counts toward `process.cpuUsage()`).

**Downstream I/O latency** (Postgres, RabbitMQ, disk) looks different: event-loop delay and utilization stay low because `await` yields the loop, but jobs or HTTP responses are still slow. The loop is healthy; the wait is outside the process.

### What in this codebase can block the event loop

- **Processor, main thread:** `JSON.parse` and validation of each import batch (`parseTransactions`), plus building fingerprint input. Batches are bounded (`IMPORT_BATCH_SIZE`, default 100) so this work yields at `await` points between batches.
- **Processor, not the loop:** risk scoring runs on the worker-thread pool, so the simulated CPU loop does not stall message handling or database I/O.
- **API:** Multer streams the upload to disk (not into memory). Request handlers then do relatively small Prisma / RabbitMQ work. Large NDJSON parsing does not run in the API process.

### How latency-sensitive endpoints are protected

- The API and the processor are **separate Node processes**. Import parsing, validation, persistence, and risk scoring never share the API event loop, so `GET /health/*`, `GET /v1/imports/:id`, cancel, summary, and rejection paging stay off the heavy path.
- Uploads are streamed to disk; the create-import handler only writes a job row and publishes a queue message.
- RabbitMQ `prefetch` caps how many jobs the processor has in flight.
- Monitoring itself is a cheap snapshot plus `console`-style log on an `unref`'d interval, and is not exposed over HTTP.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Manual tests

- [Concurrent import idempotency test](docs/concurrent-import-idempotency-test.md) — verifies that parallel `POST /v1/imports` requests with the same file and `Idempotency-Key` return the same job and create only one database row.

```bash
npm run import:concurrent
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
# transaction-service
