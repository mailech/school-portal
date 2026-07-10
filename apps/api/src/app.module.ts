import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig, loadConfig } from './config/app-config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AcademicModule } from './academic/academic.module';
import { FeesModule } from './fees/fees.module';
import { StudentsModule } from './students/students.module';
import { DuesModule } from './dues/dues.module';
import { RepliesModule } from './replies/replies.module';
import { SettingsModule } from './settings/settings.module';
import { LogsModule } from './logs/logs.module';
import { DevModule } from './dev/dev.module';
import { HealthModule } from './health/health.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { JwtAuthGuard, RolesGuard } from './common/guards';

const bootConfig = loadConfig();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        level: bootConfig.isProd ? 'info' : 'debug',
        transport: bootConfig.isProd
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
          ],
          remove: true,
        },
        autoLogging: { ignore: (req) => req.url === `/${bootConfig.api.globalPrefix}/health` },
      },
    }),
    AppConfigModule,
    PrismaModule,
    AuditModule,
    QueueModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: config.throttle.ttlSec * 1000, limit: config.throttle.limit }],
      }),
    }),
    AuthModule,
    UsersModule,
    AcademicModule,
    FeesModule,
    StudentsModule,
    DuesModule,
    RepliesModule,
    SettingsModule,
    LogsModule,
    DevModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
