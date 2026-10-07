import { NotFoundException, PipeTransform } from '@nestjs/common';
import { GAME_IDS, GAMES, isGameId, LotteryGame } from './lottery';

/** Converte o segmento `:game` da rota no jogo correspondente (404 se desconhecido). */
export class GamePipe implements PipeTransform<string, LotteryGame> {
  transform(value: string): LotteryGame {
    if (!isGameId(value)) throw new NotFoundException(`Jogo desconhecido: ${value}. Use ${GAME_IDS.join(', ')}.`);
    return GAMES[value];
  }
}
