import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { GameStatus } from '@prisma/odds-client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class GetGamesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: GameStatus,
    description: 'Filter games by status',
    example: GameStatus.UPCOMING,
  })
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;
}
