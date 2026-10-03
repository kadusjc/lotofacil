import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, QueryResult, RecordShape } from 'neo4j-driver';
import { AppConfig } from '../config/configuration';
import { DRAW_EMBEDDING_DIMENSIONS } from '../embeddings/embeddings';

export const DRAW_VECTOR_INDEX = 'draw_embedding_index';

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
    const statements = [
      'CREATE CONSTRAINT draw_concurso IF NOT EXISTS FOR (d:Draw) REQUIRE d.concurso IS UNIQUE',
      'CREATE CONSTRAINT number_value IF NOT EXISTS FOR (n:Number) REQUIRE n.value IS UNIQUE',
      'CREATE INDEX draw_date IF NOT EXISTS FOR (d:Draw) ON (d.date)',
      `CREATE VECTOR INDEX ${DRAW_VECTOR_INDEX} IF NOT EXISTS FOR (d:Draw) ON d.embedding
       OPTIONS { indexConfig: { \`vector.dimensions\`: ${DRAW_EMBEDDING_DIMENSIONS}, \`vector.similarity_function\`: 'cosine' } }`,
      'UNWIND range(1, 25) AS v MERGE (:Number {value: v})',
    ];
    for (const statement of statements) await this.write(statement);
  }
}
