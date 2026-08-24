import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CancellationRequest, Job } from '../../generated/prisma/client';
import { CancellationRequestsService } from '../cancellation-requests/cancellation-requests.service';
import { JobsService } from '../jobs/jobs.service';
import { RabbitmqPublisherService } from '../rabbitmq-publisher/rabbitmq-publisher.service';
import { RejectedTransactionLinesService } from '../rejected-transaction-lines/rejected-transaction-lines.service';
import { FileStorageService } from '../storage/file-storage.service';
import { TransactionLinesRepository } from '../transaction-lines/transaction-lines.repository';
import { ImportsService } from './imports.service';

async function createService() {
  const jobsService = {
    createImportJob: jest.fn(),
    findImportJobById: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const rabbitmqPublisher = {
    publishProcessTransactionJob: jest.fn(),
  };
  const cancellationRequestsService = {
    createCancellationRequest: jest.fn(),
  };
  const fileStorage = {
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const module = await Test.createTestingModule({
    providers: [
      ImportsService,
      { provide: JobsService, useValue: jobsService },
      { provide: RabbitmqPublisherService, useValue: rabbitmqPublisher },
      { provide: TransactionLinesRepository, useValue: {} },
      {
        provide: CancellationRequestsService,
        useValue: cancellationRequestsService,
      },
      { provide: RejectedTransactionLinesService, useValue: {} },
      { provide: FileStorageService, useValue: fileStorage },
    ],
  }).compile();

  return {
    service: module.get(ImportsService),
    jobsService,
    rabbitmqPublisher,
    fileStorage,
    cancellationRequestsService,
  };
}

function makeJob(status: Job['status']): Job {
  return {
    id: 'job-1',
    idempotencyKey: 'key-1',
    status,
    processed: 0,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    startedAt: new Date('2026-08-24T12:00:00.000Z'),
    completedAt: null,
    failureReason: null,
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:00:00.000Z'),
  };
}

const job = { id: 'job-1' };
const cancellationRequest: CancellationRequest = {
  id: 'cr-1',
  jobId: 'job-1',
  reason: 'duplicate upload',
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
};

describe('ImportsService.createImport', () => {
  it('deletes the upload when the idempotency key already exists', async () => {
    const { service, jobsService, rabbitmqPublisher, fileStorage } =
      await createService();
    jobsService.createImportJob.mockResolvedValue({ job, created: false });

    await expect(service.createImport('key-1', 'file.ndjson')).resolves.toBe(
      job,
    );

    expect(fileStorage.remove).toHaveBeenCalledWith('file.ndjson');
    expect(
      rabbitmqPublisher.publishProcessTransactionJob,
    ).not.toHaveBeenCalled();
  });

  it('deletes the upload when publishing the job fails', async () => {
    const { service, jobsService, rabbitmqPublisher, fileStorage } =
      await createService();
    jobsService.createImportJob.mockResolvedValue({ job, created: true });
    rabbitmqPublisher.publishProcessTransactionJob.mockRejectedValue(
      new Error('broker down'),
    );

    await expect(service.createImport('key-1', 'file.ndjson')).rejects.toThrow(
      'broker down',
    );
    expect(fileStorage.remove).toHaveBeenCalledWith('file.ndjson');
  });

  it('keeps the upload after a successful publish', async () => {
    const { service, jobsService, rabbitmqPublisher, fileStorage } =
      await createService();
    jobsService.createImportJob.mockResolvedValue({ job, created: true });
    rabbitmqPublisher.publishProcessTransactionJob.mockResolvedValue(undefined);

    await expect(service.createImport('key-1', 'file.ndjson')).resolves.toBe(
      job,
    );

    expect(fileStorage.remove).not.toHaveBeenCalled();
    expect(rabbitmqPublisher.publishProcessTransactionJob).toHaveBeenCalledWith(
      {
        jobId: 'job-1',
        storageKey: 'file.ndjson',
      },
    );
  });
});

describe('ImportsService.requestCancellation', () => {
  it.each(['pending', 'processing'] as const)(
    'records a request and moves a %s job to cancelling',
    async (status) => {
      const { service, jobsService, cancellationRequestsService } =
        await createService();
      jobsService.findImportJobById.mockResolvedValue(makeJob(status));
      cancellationRequestsService.createCancellationRequest.mockResolvedValue(
        cancellationRequest,
      );

      await expect(
        service.requestCancellation('job-1', 'duplicate upload'),
      ).resolves.toBe(cancellationRequest);

      expect(
        cancellationRequestsService.createCancellationRequest,
      ).toHaveBeenCalledWith('job-1', 'duplicate upload');
      expect(jobsService.update).toHaveBeenCalledWith('job-1', {
        status: 'cancelling',
      });
    },
  );

  it.each(['completed', 'failed', 'cancelling', 'cancelled'] as const)(
    'rejects cancellation when the job is %s',
    async (status) => {
      const { service, jobsService, cancellationRequestsService } =
        await createService();
      jobsService.findImportJobById.mockResolvedValue(makeJob(status));

      await expect(service.requestCancellation('job-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(
        cancellationRequestsService.createCancellationRequest,
      ).not.toHaveBeenCalled();
      expect(jobsService.update).not.toHaveBeenCalled();
    },
  );

  it('rejects cancellation of an unknown job', async () => {
    const { service, jobsService, cancellationRequestsService } =
      await createService();
    jobsService.findImportJobById.mockResolvedValue(null);

    await expect(service.requestCancellation('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(
      cancellationRequestsService.createCancellationRequest,
    ).not.toHaveBeenCalled();
  });
});
