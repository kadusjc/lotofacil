import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GAME_IDS, GAMES, isGameId } from '../common/lottery';
import { DrawsService } from '../draws/draws.service';

/** `npm run sync [-- megasena]` — sincroniza os resultados (todos os jogos por padrão) sem subir o servidor HTTP. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const arg = process.argv[2];
    if (arg !== undefined && !isGameId(arg)) throw new Error(`Jogo desconhecido: ${arg}. Use ${GAME_IDS.join(', ')}.`);
    for (const id of arg !== undefined ? [arg] : GAME_IDS) {
      const status = await app.get(DrawsService).sync(GAMES[id]);
      Logger.log(`${GAMES[id].name}: ${status.message}`, 'Sync');
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
