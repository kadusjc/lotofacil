import { Module } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { DrawsController } from './draws.controller';
import { DrawsRepository } from './draws.repository';
import { DrawsService } from './draws.service';

@Module({
  controllers: [DrawsController],
  providers: [DrawsService, DrawsRepository, ScraperService],
  exports: [DrawsService],
})
export class DrawsModule {}
