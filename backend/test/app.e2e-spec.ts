import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DrawsService } from '../src/draws/draws.service';
import { Neo4jService } from '../src/neo4j/neo4j.service';
import { setupApp } from '../src/setup-app';
import { syntheticDraws } from '../src/test-utils/fixtures';

/** Sobe a aplicação inteira com Neo4j e scraper simulados. */
describe('API (e2e)', () => {
  let app: INestApplication;
  const draws = syntheticDraws(300);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Neo4jService)
      .useValue({ isHealthy: async () => true })
      .overrideProvider(DrawsService)
      .useValue({
        findAll: async () => draws,
        findPage: async () => ({ items: draws.slice(0, 2), total: draws.length }),
        getSyncStatus: () => ({ state: 'idle' }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/health', () => request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok', neo4j: true }));

  it('GET /api/draws paginates', async () => {
    const res = await request(app.getHttpServer()).get('/api/draws?page=1&pageSize=2').expect(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /api/probabilities', async () => {
    const res = await request(app.getHttpServer()).get('/api/probabilities').expect(200);
    expect(res.body.rows).toHaveLength(6);
  });

  it('POST /api/suggestions validates input', async () => {
    await request(app.getHttpServer()).post('/api/suggestions').send({ betSize: 30 }).expect(400);
    const res = await request(app.getHttpServer()).post('/api/suggestions').send({ betSize: 15, games: 2 }).expect(200);
    expect(res.body.games).toHaveLength(2);
  });

  it('POST /api/plan returns recommendation with games', async () => {
    const res = await request(app.getHttpServer()).post('/api/plan').send({ budget: 56 }).expect(200);
    expect(res.body.recommended.kind).toBe('multiple-games');
    expect(res.body.recommended.games.length).toBe(16);
  });

  it('GET /api/stats/summary', async () => {
    const res = await request(app.getHttpServer()).get('/api/stats/summary').expect(200);
    expect(res.body.numbers).toHaveLength(25);
  });
});
