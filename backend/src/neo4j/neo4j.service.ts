import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, QueryResult, RecordShape } from 'neo4j-driver';
import { AppConfig } from '../config/configuration';
import { GAMES } from '../common/lottery';
import { drawEmbeddingDimensions } from '../embeddings/embeddings';

@Injectable()
export class Neo4jService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(Neo4jService.name);
  private readonly driver: Driver;

  constructor(config: ConfigService<AppConfig, true>) {
    const { uri, user, password } = config.get('neo4j', { infer: true });
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      disableLosslessIntegers: true,
      maxConnectionPoolSize: 20,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.driver.verifyConnectivity();
    await this.ensureSchema();
    this.logger.log('Conectado ao Neo4j e schema garantido');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.driver.close();
  }

  read<T extends RecordShape = RecordShape>(cypher: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    return this.driver.executeQuery<QueryResult<T>>(cypher, params, { routing: neo4j.routing.READ });
  }

  write<T extends RecordShape = RecordShape>(cypher: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    return this.driver.executeQuery<QueryResult<T>>(cypher, params, { routing: neo4j.routing.WRITE });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  private async ensureSchema(): Promise<void> {
    // Um conjunto de rótulos por jogo; os nomes da Lotofácil são os originais (sem migração).
    const statements = Object.values(GAMES).flatMap((game) => {
      const g = game.graph;
      return [
        `CREATE CONSTRAINT ${g.drawConstraint} IF NOT EXISTS FOR (d:${g.draw}) REQUIRE d.concurso IS UNIQUE`,
        `CREATE CONSTRAINT ${g.numberConstraint} IF NOT EXISTS FOR (n:${g.number}) REQUIRE n.value IS UNIQUE`,
        `CREATE INDEX ${g.dateIndex} IF NOT EXISTS FOR (d:${g.draw}) ON (d.date)`,
        `CREATE VECTOR INDEX ${g.vectorIndex} IF NOT EXISTS FOR (d:${g.draw}) ON d.embedding
         OPTIONS { indexConfig: { \`vector.dimensions\`: ${drawEmbeddingDimensions(game)}, \`vector.similarity_function\`: 'cosine' } }`,
        `UNWIND range(1, ${game.totalNumbers}) AS v MERGE (:${g.number} {value: v})`,
      ];
    });
    for (const statement of statements) await this.write(statement);
  }
}
