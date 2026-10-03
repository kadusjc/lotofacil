import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Neo4jService } from '../neo4j/neo4j.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly neo4j: Neo4jService) {}

  @Get()
  async check() {
    const neo4j = await this.neo4j.isHealthy();
    return { status: neo4j ? 'ok' : 'degraded', neo4j };
  }
}
