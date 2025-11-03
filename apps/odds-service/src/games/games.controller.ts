import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GamesService } from './games.service';
import { GameResponseDto } from './dto/game-response.dto';
import { GenerateResultDto } from './dto/generate-result.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all games with odds (paginated)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of games',
    schema: {
      allOf: [
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/GameResponseDto' },
            },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrevious: { type: 'boolean' },
              },
            },
          },
        },
      ],
    },
  })
  async findAll(
    @Query('status') status?: string,
    @Query() paginationQuery?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<GameResponseDto>> {
    return this.gamesService.findAll(status, paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game by ID' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({
    status: 200,
    description: 'Game details',
    type: GameResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @Post(':id/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate result for a game' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({
    status: 200,
    description: 'Result generated',
    type: GameResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 400, description: 'Game already finished or not started' })
  async generateResult(
    @Param('id') id: string,
    @Body() generateResultDto: GenerateResultDto,
  ) {
    return this.gamesService.generateResult(id, generateResultDto);
  }
}
