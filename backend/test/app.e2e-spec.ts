import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DrawsService } from '../src/draws/draws.service';
import { Neo4jService } from '../src/neo4j/neo4j.service';
import { setupApp } from '../src/setup-app';
import { syntheticDraws } from '../src/test-utils/fixtures';
import { LotteryGame, MEGASENA } from '../src/common/lottery';

/** Sobe a aplicação inteira com Neo4j e scraper simulados. */
describe('API (e2e)', () => {
  let app: INestApplication;
  const draws = syntheticDraws(300);
  const mega = syntheticDraws(300, 9, MEGASENA);
  const byGame = (game: LotteryGame) => (game.id === 'megasena' ? mega : draws);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Neo4jService)
      .useValue({ isHealthy: async () => true })
      .overrideProvider(DrawsService)
      .useValue({
        findAll: async (game: LotteryGame) => byGame(game),
        findPage: async (game: LotteryGame) => ({ items: byGame(game).slice(0, 2), total: byGame(game).length }),
        getSyncStatus: () => ({ state: 'idle' }),
        saveChecks: async () => undefined,
      })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/health', () => request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok', neo4j: true }));

  it('GET /api/draws paginates', async () => {
    const res = await request(app.getHttpServer()).get('/api/lotofacil/draws?page=1&pageSize=2').expect(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /api/probabilities', async () => {
    const res = await request(app.getHttpServer()).get('/api/lotofacil/probabilities').expect(200);
    expect(res.body.rows).toHaveLength(6);
  });

  it('POST /api/suggestions validates input', async () => {
    await request(app.getHttpServer()).post('/api/lotofacil/suggestions').send({ betSize: 30 }).expect(400);
    const res = await request(app.getHttpServer()).post('/api/lotofacil/suggestions').send({ betSize: 15, games: 2 }).expect(200);
    expect(res.body.games).toHaveLength(2);
  });

  it('POST /api/plan returns recommendation with games', async () => {
    const res = await request(app.getHttpServer()).post('/api/lotofacil/plan').send({ budget: 56 }).expect(200);
    expect(res.body.recommended.kind).toBe('multiple-games');
    expect(res.body.recommended.games.length).toBe(16);
  });

  it('POST /api/check confere apostas', async () => {
    await request(app.getHttpServer()).post('/api/lotofacil/check').send({ bets: [[1, 2, 3]] }).expect(400);
    const last = draws[draws.length - 1];
    const res = await request(app.getHttpServer()).post('/api/lotofacil/check').send({ bets: [last.numbers, draws[0].numbers] }).expect(200);
    expect(res.body.bets[0].hits).toBe(15);
    expect(res.body.bets).toHaveLength(2);
    expect(res.body.signals).toHaveLength(5);
  });

  it('GET /api/stats/summary', async () => {
    const res = await request(app.getHttpServer()).get('/api/lotofacil/stats/summary').expect(200);
    expect(res.body.numbers).toHaveLength(25);
  });

  it('Mega-Sena: plano, resumo e jogo desconhecido', async () => {
    const plan = await request(app.getHttpServer()).post('/api/megasena/plan').send({ budget: 42 }).expect(200);
    expect(plan.body.recommended.games).toHaveLength(7);
    expect(plan.body.recommended.games[0].numbers).toHaveLength(6);
    const summary = await request(app.getHttpServer()).get('/api/megasena/stats/summary').expect(200);
    expect(summary.body.numbers).toHaveLength(60);
    await request(app.getHttpServer()).get('/api/lotomania/probabilities').expect(404);
    await request(app.getHttpServer()).post('/api/megasena/suggestions').send({ betSize: 5 }).expect(400);
  });
});
