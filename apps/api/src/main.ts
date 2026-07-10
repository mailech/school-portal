import 'reflect-metadata';
import './load-env';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors({ origin: config.api.webOrigin, credentials: true });
  app.setGlobalPrefix(config.api.globalPrefix);
  app.enableShutdownHooks();

  await app.listen(config.api.port);
  const logger = app.get(Logger);
  logger.log(
    `API listening on http://localhost:${config.api.port}/${config.api.globalPrefix}`,
    'Bootstrap',
  );
}

void bootstrap();
