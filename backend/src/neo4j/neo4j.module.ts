import { Global, Module } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';

@Global()
@Module({
  providers: [Neo4jService],
  exports: [Neo4jService],
})
export class Neo4jModule {}
