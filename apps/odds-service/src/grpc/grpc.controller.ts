import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GamesService } from '../games/games.service';

interface GetGameOddsRequest {
  gameId: string;
}

interface ValidateGameRequest {
  gameId: string;
}

interface GetGamesByIdsRequest {
  gameIds: string[];
}

@Controller()
export class GrpcController {
  constructor(private readonly gamesService: GamesService) {}

  @GrpcMethod('OddsService', 'GetGameOdds')
  async getGameOdds(data: GetGameOddsRequest) {
    try {
      const game = await this.gamesService.findOne(data.gameId);

      // Find the best odds (highest for home/away, considering first bookmaker for simplicity)
      const bestOdds = game.odds[0] || null;

      return {
        success: true,
        message: 'Game odds retrieved successfully',
        gameOdds: {
          gameId: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeOdds: bestOdds?.homeOdds || 2.0,
          awayOdds: bestOdds?.awayOdds || 2.0,
          drawOdds: bestOdds?.drawOdds || 3.0,
          status: game.status,
          startTime: game.startTime.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve game odds',
        gameOdds: null,
      };
    }
  }

  @GrpcMethod('OddsService', 'ValidateGame')
  async validateGame(data: ValidateGameRequest) {
    const validation = await this.gamesService.validateGame(data.gameId);
    return validation;
  }

  @GrpcMethod('OddsService', 'GetGamesByIds')
  async getGamesByIds(data: GetGamesByIdsRequest) {
    const games = await this.gamesService.findByIds(data.gameIds);

    return {
      games: games.map((game) => ({
        id: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        sportKey: game.sportKey,
        status: game.status,
        startTime: game.startTime.toISOString(),
        homeScore: game.homeScore || 0,
        awayScore: game.awayScore || 0,
        odds: game.odds.map((odd) => ({
          id: odd.id,
          bookmaker: odd.bookmaker,
          market: odd.market,
          homeOdds: odd.homeOdds || 0,
          awayOdds: odd.awayOdds || 0,
          drawOdds: odd.drawOdds || 0,
        })),
      })),
    };
  }
}
