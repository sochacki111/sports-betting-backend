import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';

export class GenerateResultDto {
  @ApiPropertyOptional({ description: 'Home team score (random if not provided)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @ApiPropertyOptional({ description: 'Away team score (random if not provided)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;
}
