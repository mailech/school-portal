import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';
import { AppException } from '../common/app-exception';
import { ErrorCode } from '@app/types';
import { HttpStatus } from '@nestjs/common';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; service: string; db: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        ErrorCode.INTERNAL,
        'Database is unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      status: 'ok',
      service: 'api',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
