import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OddsDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bookmaker: string;

  @ApiProperty()
  market: string;

  @ApiPropertyOptional()
  homeOdds?: number;

  @ApiPropertyOptional()
  awayOdds?: number;

  @ApiPropertyOptional()
  drawOdds?: number;

  @ApiProperty()
  lastUpdate: Date;
}

export class GameResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sportKey: string;

  @ApiProperty()
  homeTeam: string;

  @ApiProperty()
  awayTeam: string;

  @ApiProperty()
  startTime: Date;

  // TODO mb to remove as no need status
  @ApiProperty({ enum: ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'] })
  status: string;

  @ApiPropertyOptional()
  homeScore?: number;

  @ApiPropertyOptional()
  awayScore?: number;

  @ApiProperty({ type: [OddsDto] })
  odds: OddsDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
