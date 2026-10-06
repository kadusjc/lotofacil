import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, Max, Min, ValidateNested } from 'class-validator';

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

  @ApiPropertyOptional({ example: 56, description: 'Testa o plano recomendado para esse orçamento (vários bilhetes)' })
  @IsOptional() @IsNumber() @IsPositive() @Max(10_000)
  budget?: number;

  @ApiPropertyOptional({ type: WeightsDto })
  @IsOptional() @ValidateNested() @Type(() => WeightsDto)
  weights?: WeightsDto;
}

export class CheckDto {
  @ApiProperty({ example: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]], description: '1 a 200 apostas de 15–20 dezenas' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsArray({ each: true })
  bets: number[][];

  @ApiPropertyOptional({ description: 'Concurso a conferir (padrão: o último importado)' })
  @IsOptional() @IsInt() @Min(1)
  concurso?: number;

  @ApiPropertyOptional({ description: 'Busca o último resultado direto no portal da Caixa antes de conferir (ignora `concurso`)' })
  @IsOptional() @IsBoolean()
  official?: boolean;
}
