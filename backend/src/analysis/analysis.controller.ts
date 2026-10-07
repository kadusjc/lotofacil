import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GamePipe } from '../common/game.pipe';
import { LotteryGame } from '../common/lottery';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BacktestDto, CheckDto, PlanDto, RecentCheckDto, SuggestDto } from './analysis.dto';
import { AnalysisService } from './analysis.service';

@ApiTags('analysis')
@Controller(':game')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('stats/summary')
  @ApiOperation({ summary: 'Estatísticas por dezena, perfis históricos e teste de uniformidade' })
  summary(@Param('game', GamePipe) game: LotteryGame) {
    return this.analysis.summary(game);
  }

  @Get('probabilities')
  @ApiOperation({ summary: 'Probabilidades exatas e custo por quantidade de dezenas' })
  probabilities(@Param('game', GamePipe) game: LotteryGame) {
    return this.analysis.probabilities(game);
  }

  @Post('suggestions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sugere jogos pelo ensemble estatístico + embeddings' })
  suggest(@Param('game', GamePipe) game: LotteryGame, @Body() dto: SuggestDto) {
    return this.analysis.suggest(game, dto);
  }

  @Post('plan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recomenda quantas dezenas comprar para um orçamento, com os números' })
  plan(@Param('game', GamePipe) game: LotteryGame, @Body() dto: PlanDto) {
    return this.analysis.plan(game, dto);
  }

  @Post('check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confere 1..N apostas, mostra o prêmio, e onde cada sinal errou (não altera os pesos)' })
  check(@Param('game', GamePipe) game: LotteryGame, @Body() dto: CheckDto) {
    return this.analysis.check(game, dto);
  }

  @Post('check/recent')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confere apostas nos últimos N concursos oficiais (busca na Caixa os que faltarem)' })
  checkRecent(@Param('game', GamePipe) game: LotteryGame, @Body() dto: RecentCheckDto) {
    return this.analysis.checkRecent(game, dto);
  }

  @Get('model')
  @ApiOperation({ summary: 'Pesos do ensemble em uso (padrão)' })
  model(@Param('game', GamePipe) _game: LotteryGame) {
    // Os pesos são os mesmos para todos os jogos; o parâmetro só valida a rota (404 se desconhecido).
    return this.analysis.currentWeights();
  }

  @Post('backtest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Backtest walk-forward da estratégia contra o acaso' })
  backtest(@Param('game', GamePipe) game: LotteryGame, @Body() dto: BacktestDto) {
    return this.analysis.backtest(game, dto);
  }
}
