import { Injectable } from '@nestjs/common';
import { type Job } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobCreateInput, JobUpdateInput } from 'generated/prisma/models';

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<Job | null> {
    return this.prisma.job.findUnique({ where: { idempotencyKey } });
  }

  create(data: JobCreateInput): Promise<Job> {
    return this.prisma.job.create({
      data,
    });
  }

  findById(id: string): Promise<Job | null> {
    return this.prisma.job.findUnique({ where: { id } });
  }

  findAll(): Promise<Job[]> {
    return this.prisma.job.findMany();
  }

  update(id: string, data: JobUpdateInput): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data,
    });
  }

  async queryRaw(idempotencyKey: string): Promise<Job[]> {
    // if result is empty it means the job is already created
    return this.prisma.$queryRaw<
      Job[]
    >` INSERT INTO "jobs" ("id", "idempotencyKey", "status")
    VALUES (gen_random_uuid(), ${idempotencyKey}, 'processing')
    ON CONFLICT ("idempotencyKey") DO NOTHING
    RETURNING *`;
  }
}
