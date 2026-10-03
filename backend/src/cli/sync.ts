import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DrawsService } from '../draws/draws.service';

/** `npm run sync` — sincroniza os resultados sem subir o servidor HTTP. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const status = await app.get(DrawsService).sync();
    Logger.log(status.message, 'Sync');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
