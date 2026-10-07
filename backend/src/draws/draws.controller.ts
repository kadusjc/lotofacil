import { Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamePipe } from '../common/game.pipe';
import { LotteryGame } from '../common/lottery';
import { PaginationDto, SimilarQueryDto } from './draws.dto';
import { DrawsService } from './draws.service';

@ApiTags('draws')
@Controller(':game')
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Get('draws')
  @ApiOperation({ summary: 'Lista concursos (mais recentes primeiro)' })
  async list(@Param('game', GamePipe) game: LotteryGame, @Query() { page, pageSize }: PaginationDto) {
    const { items, total } = await this.draws.findPage(game, page, pageSize);
    return { items, total, page, pageSize };
  }

  @Get('draws/latest')
  @ApiOperation({ summary: 'Último concurso importado' })
  async latest(@Param('game', GamePipe) game: LotteryGame) {
    const all = await this.draws.findAll(game);
    return all[all.length - 1] ?? null;
  }

  @Get('draws/:concurso')
  findOne(@Param('game', GamePipe) game: LotteryGame, @Param('concurso', ParseIntPipe) concurso: number) {
    return this.draws.findOne(game, concurso);
  }

  @Get('draws/:concurso/similar')
  @ApiOperation({ summary: 'Concursos mais similares (índice vetorial Neo4j) e o concurso seguinte de cada um' })
  similar(@Param('game', GamePipe) game: LotteryGame, @Param('concurso', ParseIntPipe) concurso: number, @Query() { k }: SimilarQueryDto) {
    return this.draws.findSimilar(game, concurso, k);
  }

  @Get('pairs')
  @ApiOperation({ summary: 'Pares de dezenas que mais saem juntos (grafo CO_OCCURS)' })
  pairs(
    @Param('game', GamePipe) game: LotteryGame,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('orderBy', new DefaultValuePipe('count')) orderBy: string,
  ) {
    return this.draws.topPairs(game, Math.min(Math.max(limit, 1), 300), orderBy === 'ppmi' ? 'ppmi' : 'count');
  }

  @Post('sync')
  @HttpCode(202)
  @ApiOperation({ summary: 'Inicia sincronização incremental com o portal da Caixa (Playwright)' })
  startSync(@Param('game', GamePipe) game: LotteryGame) {
    return this.draws.startSync(game);
  }

  @Get('sync/status')
  syncStatus(@Param('game', GamePipe) game: LotteryGame) {
    return this.draws.getSyncStatus(game);
  }
}
