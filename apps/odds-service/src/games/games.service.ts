import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus } from '@prisma/odds-client';
import { GenerateResultDto } from './dto/generate-result.dto';

interface OddsApiGame {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('oddsApi.key', '');
    this.apiBaseUrl = this.configService.get<string>(
      'oddsApi.baseUrl',
      'https://api.the-odds-api.com/v4',
    );
  }

  async refreshOdds(): Promise<{ message: string; gamesUpdated: number }> {
    this.logger.log('Starting odds refresh from The Odds API');

    try {
      // Fetch odds for popular sports (e.g., basketball, soccer)
      const sports = this.configService.get<string[]>('oddsApi.supportedSports', [
        'basketball_nba',
        'soccer_epl',
        'americanfootball_nfl',
      ]);
      let totalGamesUpdated = 0;

      for (const sport of sports) {
        const url = `${this.apiBaseUrl}/sports/${sport}/odds`;
        this.logger.debug(`Fetching odds for ${sport} from ${url}`);

        try {
          const response = await axios.get<OddsApiGame[]>(url, {
            params: {
              apiKey: this.apiKey,
              regions: 'us,uk',
              markets: 'h2h',
              oddsFormat: 'decimal',
            },
          });

          const games = response.data;
          this.logger.log(`Fetched ${games.length} games for ${sport}`);

          // TODO: Optimize with batch operations
          for (const gameData of games) {
            await this.upsertGameWithOdds(gameData);
            totalGamesUpdated++;
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch odds for ${sport}: ${error.message}`);
        }
      }

      this.logger.log(`Odds refresh completed. ${totalGamesUpdated} games updated`);
      return {
        message: 'Odds refreshed successfully',
        gamesUpdated: totalGamesUpdated,
      };
    } catch (error) {
      this.logger.error('Failed to refresh odds', error);
      throw new BadRequestException('Failed to refresh odds from API');
    }
  }

  private async upsertGameWithOdds(gameData: OddsApiGame): Promise<void> {
    const game = await this.prisma.game.upsert({
      where: { externalId: gameData.id },
      update: {
        homeTeam: gameData.home_team,
        awayTeam: gameData.away_team,
        startTime: new Date(gameData.commence_time),
        updatedAt: new Date(),
      },
      create: {
        externalId: gameData.id,
        sportKey: gameData.sport_key,
        homeTeam: gameData.home_team,
        awayTeam: gameData.away_team,
        startTime: new Date(gameData.commence_time),
        status: GameStatus.UPCOMING,
      },
    });

    // Delete old odds for this game
    await this.prisma.odds.deleteMany({
      where: { gameId: game.id },
    });

    // Insert new odds
    if (gameData.bookmakers && gameData.bookmakers.length > 0) {
      for (const bookmaker of gameData.bookmakers) {
        const h2hMarket = bookmaker.markets.find((m) => m.key === 'h2h');
        if (!h2hMarket) continue;

        const homeOutcome = h2hMarket.outcomes.find(
          (o) => o.name === gameData.home_team,
        );
        const awayOutcome = h2hMarket.outcomes.find(
          (o) => o.name === gameData.away_team,
        );
        const drawOutcome = h2hMarket.outcomes.find((o) => o.name === 'Draw');

        await this.prisma.odds.create({
          data: {
            gameId: game.id,
            bookmaker: bookmaker.key,
            market: 'h2h',
            homeOdds: homeOutcome?.price,
            awayOdds: awayOutcome?.price,
            drawOdds: drawOutcome?.price,
            lastUpdate: new Date(),
          },
        });
      }
    }

    this.logger.debug(
      `Upserted game: ${game.homeTeam} vs ${game.awayTeam} with ${gameData.bookmakers?.length || 0} bookmakers`,
    );
  }

  async findAll(status?: string) {
    const where = status ? { status: status as GameStatus } : {};

    const games = await this.prisma.game.findMany({
      where,
      include: {
        odds: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return games;
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        odds: true,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return game;
  }

  async findByIds(ids: string[]) {
    return this.prisma.game.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        odds: true,
      },
    });
  }

  async generateResult(
    id: string,
    generateResultDto: GenerateResultDto,
  ): Promise<any> {
    const game = await this.findOne(id);

    if (game.status === GameStatus.FINISHED) {
      throw new BadRequestException('Game is already finished');
    }

    // Commented out for demo purposes - normally would check if game started
    // if (game.status === GameStatus.UPCOMING) {
    //   const now = new Date();
    //   if (now < game.startTime) {
    //     throw new BadRequestException('Game has not started yet');
    //   }
    // }

    // Generate random scores if not provided
    const homeScore =
      generateResultDto.homeScore !== undefined
        ? generateResultDto.homeScore
        : Math.floor(Math.random() * 5);
    const awayScore =
      generateResultDto.awayScore !== undefined
        ? generateResultDto.awayScore
        : Math.floor(Math.random() * 5);

    const updatedGame = await this.prisma.game.update({
      where: { id },
      data: {
        status: GameStatus.FINISHED,
        homeScore,
        awayScore,
        updatedAt: new Date(),
      },
      include: {
        odds: true,
      },
    });

    this.logger.log(
      `Generated result for game ${id}: ${homeScore} - ${awayScore}`,
    );

    return updatedGame;
  }

  async validateGame(gameId: string): Promise<{
    isValid: boolean;
    message: string;
    status: string;
  }> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return {
        isValid: false,
        message: 'Game not found',
        status: 'NOT_FOUND',
      };
    }

    if (game.status !== GameStatus.UPCOMING) {
      return {
        isValid: false,
        message: `Game is ${game.status.toLowerCase()}`,
        status: game.status,
      };
    }

    const now = new Date();
    if (now > game.startTime) {
      return {
        isValid: false,
        message: 'Game has already started',
        status: game.status,
      };
    }

    return {
      isValid: true,
      message: 'Game is valid for betting',
      status: game.status,
    };
  }
}
