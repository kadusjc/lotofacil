import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisModule } from './analysis/analysis.module';
import { loadConfig } from './config/configuration';
import { DrawsModule } from './draws/draws.module';
import { HealthController } from './health/health.controller';
import { Neo4jModule } from './neo4j/neo4j.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [() => ({ ...loadConfig() })] }),
    Neo4jModule,
    DrawsModule,
    AnalysisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
