import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Configuração compartilhada entre main.ts e testes e2e. */
export function setupApp(app: INestApplication, corsOrigin?: string): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: corsOrigin ?? true });
  app.enableShutdownHooks();
}
