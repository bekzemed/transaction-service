import { ApiProperty } from '@nestjs/swagger';

export class HealthLiveRto {
  @ApiProperty({ example: 'ok' })
  readonly status: 'ok';

  constructor() {
    this.status = 'ok';
  }
}

export class HealthReadyRto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  readonly status: 'ok' | 'error';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  readonly server: 'up' | 'down';

  constructor(status: 'ok' | 'error', server: 'up' | 'down') {
    this.status = status;
    this.server = server;
  }

  static ok(): HealthReadyRto {
    return new HealthReadyRto('ok', 'up');
  }

  static error(): HealthReadyRto {
    return new HealthReadyRto('error', 'down');
  }
}
