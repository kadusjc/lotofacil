import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);
  setupApp(app, config.get('corsOrigin', { infer: true }));

  const swagger = new DocumentBuilder()
    .setTitle('Loterias Lab API (Lotofácil, Mega-Sena, Quina, Dia de Sorte)')
    .setDescription('Coleta (Playwright), grafo + embeddings (Neo4j), estatística, sugestões e backtest')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get('port', { infer: true });
  await app.listen(port);
  Logger.log(`API em http://localhost:${port}/api — Swagger em http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
