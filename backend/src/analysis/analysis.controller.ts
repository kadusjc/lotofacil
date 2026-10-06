import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BacktestDto, CheckDto, PlanDto, SuggestDto } from './analysis.dto';
import { AnalysisService } from './analysis.service';

@ApiTags('analysis')
@Controller()
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('stats/summary')
  @ApiOperation({ summary: 'Estatísticas por dezena, perfis históricos e teste de uniformidade' })
  summary() {
    return this.analysis.summary();
  }

  @Get('probabilities')
  @ApiOperation({ summary: 'Probabilidades exatas e custo por quantidade de dezenas (15–20)' })
  probabilities() {
    return this.analysis.probabilities();
  }

  @Post('suggestions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sugere jogos pelo ensemble estatístico + embeddings' })
  suggest(@Body() dto: SuggestDto) {
    return this.analysis.suggest(dto);
  }

  @Post('plan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recomenda quantas dezenas comprar para um orçamento, com os números' })
  plan(@Body() dto: PlanDto) {
    return this.analysis.plan(dto);
  }

  @Post('check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confere 1..N apostas, mostra o prêmio, onde cada sinal errou e recalibra os pesos' })
  check(@Body() dto: CheckDto) {
    return this.analysis.check(dto);
  }

  @Get('model')
  @ApiOperation({ summary: 'Pesos do ensemble em uso (padrão + calibração)' })
  model() {
    return this.analysis.currentWeights();
  }

  @Post('backtest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Backtest walk-forward da estratégia contra o acaso' })
  backtest(@Body() dto: BacktestDto) {
    return this.analysis.backtest(dto);
  }
}
