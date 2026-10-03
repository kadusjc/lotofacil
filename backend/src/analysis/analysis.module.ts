import { Module } from '@nestjs/common';
import { DrawsModule } from '../draws/draws.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [DrawsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
