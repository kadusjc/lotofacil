import { Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto, SimilarQueryDto } from './draws.dto';
import { DrawsService } from './draws.service';

@ApiTags('draws')
@Controller()
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Get('draws')
  @ApiOperation({ summary: 'Lista concursos (mais recentes primeiro)' })
  async list(@Query() { page, pageSize }: PaginationDto) {
    const { items, total } = await this.draws.findPage(page, pageSize);
    return { items, total, page, pageSize };
  }

  @Get('draws/latest')
  @ApiOperation({ summary: 'Último concurso importado' })
  async latest() {
    const all = await this.draws.findAll();
    return all[all.length - 1] ?? null;
  }

  @Get('draws/:concurso')
  findOne(@Param('concurso', ParseIntPipe) concurso: number) {
    return this.draws.findOne(concurso);
  }

  @Get('draws/:concurso/similar')
  @ApiOperation({ summary: 'Concursos mais similares (índice vetorial Neo4j) e o concurso seguinte de cada um' })
  similar(@Param('concurso', ParseIntPipe) concurso: number, @Query() { k }: SimilarQueryDto) {
    return this.draws.findSimilar(concurso, k);
  }

  @Get('pairs')
  @ApiOperation({ summary: 'Pares de dezenas que mais saem juntos (grafo CO_OCCURS)' })
  pairs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('orderBy', new DefaultValuePipe('count')) orderBy: string,
  ) {
    return this.draws.topPairs(Math.min(Math.max(limit, 1), 300), orderBy === 'ppmi' ? 'ppmi' : 'count');
  }

  @Post('sync')
  @HttpCode(202)
  @ApiOperation({ summary: 'Inicia sincronização incremental com o portal da Caixa (Playwright)' })
  startSync() {
    return this.draws.startSync();
  }

  @Get('sync/status')
  syncStatus() {
    return this.draws.getSyncStatus();
  }
}
