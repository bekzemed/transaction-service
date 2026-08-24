import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthLiveRto, HealthReadyRto } from './rto/health.rto';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness',
    description:
      'Returns 200 when this process is running. Does not check whether the HTTP server is accepting traffic.',
  })
  @ApiOkResponse({ type: HealthLiveRto })
  live(): HealthLiveRto {
    return this.healthService.live();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness',
    description:
      'Returns 200 when this HTTP server has finished bootstrap, is listening, and is not shutting down. ' +
      'Dependency readiness (PostgreSQL, RabbitMQ) is owned by Docker Compose healthchecks.',
  })
  @ApiOkResponse({ type: HealthReadyRto })
  @ApiServiceUnavailableResponse({ type: HealthReadyRto })
  ready(): HealthReadyRto {
    const result = this.healthService.ready();

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
