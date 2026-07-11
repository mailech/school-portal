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

  // Render (and most PaaS hosts) inject the port to bind on via $PORT.
  // Fall back to the configured API_PORT for local/dev runs.
  const port = process.env.PORT ? Number(process.env.PORT) : config.api.port;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`API listening on port ${port} (prefix /${config.api.globalPrefix})`, 'Bootstrap');
}

void bootstrap();
