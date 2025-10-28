import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GamesService } from '../games/games.service';

@ApiTags('odds')
@Controller('odds')
export class OddsController {
  constructor(private readonly gamesService: GamesService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh odds from The Odds API' })
  @ApiResponse({
    status: 200,
    description: 'Odds refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        gamesUpdated: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Failed to refresh odds' })
  async refreshOdds() {
    return this.gamesService.refreshOdds();
  }
}
