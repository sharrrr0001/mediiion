import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { APP_NAME } from '@medicos/shared';
import { AppModule, type AppOptions } from './app.module';
import { loadEnv } from './config/env';

/** Builds the app with the same middleware for `main.ts` and tests. */
export async function createApp(opts: AppOptions = {}): Promise<NestExpressApplication> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(opts), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Behind proxies: 1 = Next dev rewrite; 2 = Vercel + Cloudflare tunnel (TRUST_PROXY_HOPS).
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet({ hsts: env.NODE_ENV === 'production', contentSecurityPolicy: env.NODE_ENV === 'production' }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle(`${APP_NAME} API`)
      .setDescription('Pre-Visit Intake Assistant API. Auth via httpOnly cookies.')
      .setVersion('0.1.0')
      .addCookieAuth('mc_at')
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  }
  return app;
}
