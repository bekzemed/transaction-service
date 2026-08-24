import { Test } from '@nestjs/testing';
import type { CancellationRequest } from '../../generated/prisma/client';
import { CancellationRequestsRepository } from './cancellation-requests.repository';
import { CancellationRequestsService } from './cancellation-requests.service';

describe('CancellationRequestsService', () => {
  const existing: CancellationRequest = {
    id: 'cr-1',
    jobId: 'job-1',
    reason: 'duplicate upload',
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
  };

  const repository = {
    findByJobId: jest.fn(),
    create: jest.fn(),
  };
  let service: CancellationRequestsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CancellationRequestsService,
        { provide: CancellationRequestsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(CancellationRequestsService);
  });

  it('creates a cancellation request when none exists', async () => {
    repository.findByJobId.mockResolvedValue(null);
    repository.create.mockResolvedValue(existing);

    await expect(
      service.createCancellationRequest('job-1', 'duplicate upload'),
    ).resolves.toBe(existing);

    expect(repository.create).toHaveBeenCalledWith({
      job: { connect: { id: 'job-1' } },
      reason: 'duplicate upload',
    });
  });

  it('stores a null reason when none is provided', async () => {
    repository.findByJobId.mockResolvedValue(null);
    repository.create.mockResolvedValue({ ...existing, reason: null });

    await service.createCancellationRequest('job-1');

    expect(repository.create).toHaveBeenCalledWith({
      job: { connect: { id: 'job-1' } },
      reason: null,
    });
  });

  it('returns the existing request instead of creating a second one', async () => {
    repository.findByJobId.mockResolvedValue(existing);

    await expect(
      service.createCancellationRequest('job-1', 'another reason'),
    ).resolves.toBe(existing);

    expect(repository.create).not.toHaveBeenCalled();
  });
});
