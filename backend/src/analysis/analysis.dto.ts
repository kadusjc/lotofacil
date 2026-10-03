import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, Max, Min, ValidateNested } from 'class-validator';

export class WeightsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(5) long?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) recent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) momentum?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) delay?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) analog?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) cohesion?: number;
}

export class SuggestDto {
  @ApiPropertyOptional({ default: 15, minimum: 15, maximum: 20 })
  @IsOptional() @IsInt() @Min(15) @Max(20)
  betSize = 15;

  @ApiPropertyOptional({ default: 1, maximum: 50 })
  @IsOptional() @IsInt() @Min(1) @Max(50)
  games = 1;

  @ApiPropertyOptional({ description: 'Semente para resultados reprodutíveis' })
  @IsOptional() @IsInt()
  seed?: number;

  @ApiPropertyOptional({ type: WeightsDto })
  @IsOptional() @ValidateNested() @Type(() => WeightsDto)
  weights?: WeightsDto;
}

export class PlanDto {
  @ApiProperty({ example: 56, description: 'Quanto pretende gastar (R$)' })
  @IsNumber() @IsPositive() @Max(1_000_000)
  budget: number;

  @ApiPropertyOptional({ type: WeightsDto })
  @IsOptional() @ValidateNested() @Type(() => WeightsDto)
  weights?: WeightsDto;
}

export class BacktestDto {
  @ApiPropertyOptional({ default: 15 })
  @IsOptional() @IsInt() @Min(15) @Max(20)
  betSize = 15;

  @ApiPropertyOptional({ default: 100, maximum: 300 })
  @IsOptional() @IsInt() @Min(10) @Max(300)
  testSize = 100;

  @ApiPropertyOptional({ type: WeightsDto })
  @IsOptional() @ValidateNested() @Type(() => WeightsDto)
  weights?: WeightsDto;
}
