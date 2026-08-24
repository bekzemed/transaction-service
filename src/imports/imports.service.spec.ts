jest.mock('../jobs/jobs.service', () => ({
  JobsService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../rabbitmq-publisher/rabbitmq-publisher.service', () => ({
  RabbitmqPublisherService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../cancellation-requests/cancellation-requests.service', () => ({
  CancellationRequestsService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../rejected-transaction-lines/rejected-transaction-lines.service',
  () => ({
    RejectedTransactionLinesService: jest.fn().mockImplementation(() => ({})),
  }),
);
jest.mock('../storage/file-storage.service', () => ({
  FileStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../transaction-lines/transaction-lines.repository', () => ({
  TransactionLinesRepository: jest.fn().mockImplementation(() => ({})),
}));

import type { CancellationRequestsService } from '../cancellation-requests/cancellation-requests.service';
import type { JobsService } from '../jobs/jobs.service';
import type { RabbitmqPublisherService } from '../rabbitmq-publisher/rabbitmq-publisher.service';
import type { RejectedTransactionLinesService } from '../rejected-transaction-lines/rejected-transaction-lines.service';
import type { FileStorageService } from '../storage/file-storage.service';
import type { TransactionLinesRepository } from '../transaction-lines/transaction-lines.repository';
import { ImportsService } from './imports.service';

function createService() {
  const jobsService = {
    createImportJob: jest.fn(),
  };
  const rabbitmqPublisher = {
    publishProcessTransactionJob: jest.fn(),
  };
  const fileStorage = {
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ImportsService(
    jobsService as unknown as JobsService,
    rabbitmqPublisher as unknown as RabbitmqPublisherService,
    {} as TransactionLinesRepository,
    {} as CancellationRequestsService,
    {} as RejectedTransactionLinesService,
    fileStorage as unknown as FileStorageService,
  );

  return { service, jobsService, rabbitmqPublisher, fileStorage };
}

const job = { id: 'job-1' };

describe('ImportsService.createImport', () => {
  it('deletes the upload when the idempotency key already exists', async () => {
    const { service, jobsService, rabbitmqPublisher, fileStorage } =
      createService();
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
      createService();
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
      createService();
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
