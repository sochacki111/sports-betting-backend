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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { calculatePagination } from '../common/helpers/pagination.helper';

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
  private readonly regions: string;
  private readonly markets: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('oddsApi.key', '');
    this.apiBaseUrl = this.configService.get<string>(
      'oddsApi.baseUrl',
      'https://api.the-odds-api.com/v4',
    );
    this.regions = this.configService.get<string>('oddsApi.regions', 'us,uk');
    this.markets = this.configService.get<string>('oddsApi.markets', 'h2h');
  }

  async refreshOdds(): Promise<{ message: string; gamesUpdated: number }> {
    this.logger.log('Starting odds refresh from The Odds API');

    try {
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
              regions: this.regions,
              markets: this.markets,
              oddsFormat: 'decimal',
            },
          });

          const games = response.data;
          this.logger.log(`Fetched ${games.length} games for ${sport}`);

          totalGamesUpdated += await this.batchUpsertGamesWithOdds(games);
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

  private async batchUpsertGamesWithOdds(
    gamesData: OddsApiGame[],
  ): Promise<number> {
    if (gamesData.length === 0) return 0;

    return this.prisma.$transaction(async (tx) => {
      let processedCount = 0;

      // Step 1: Get existing games by externalId
      const externalIds = gamesData.map((g) => g.id);
      const existingGames = await tx.game.findMany({
        where: { externalId: { in: externalIds } },
        select: { id: true, externalId: true },
      });

      const existingGameMap = new Map(
        existingGames.map((g) => [g.externalId, g.id]),
      );

      // Step 2: Separate games into updates and creates
      const gamesToUpdate: Array<{ id: string; data: OddsApiGame }> = [];
      const gamesToCreate: OddsApiGame[] = [];

      for (const gameData of gamesData) {
        const existingGameId = existingGameMap.get(gameData.id);
        if (existingGameId) {
          gamesToUpdate.push({ id: existingGameId, data: gameData });
        } else {
          gamesToCreate.push(gameData);
        }
      }

      // Step 3: Batch update existing games
      if (gamesToUpdate.length > 0) {
        await Promise.all(
          gamesToUpdate.map((item) =>
            tx.game.update({
              where: { id: item.id },
              data: {
                homeTeam: item.data.home_team,
                awayTeam: item.data.away_team,
                startTime: new Date(item.data.commence_time),
                updatedAt: new Date(),
              },
            }),
          ),
        );
        processedCount += gamesToUpdate.length;
      }

      // Step 4: Batch create new games
      let createdGames: Array<{ id: string; externalId: string | null }> = [];
      if (gamesToCreate.length > 0) {
        await tx.game.createMany({
          data: gamesToCreate.map((gameData) => ({
            externalId: gameData.id,
            sportKey: gameData.sport_key,
            homeTeam: gameData.home_team,
            awayTeam: gameData.away_team,
            startTime: new Date(gameData.commence_time),
            status: GameStatus.UPCOMING,
          })),
        });

        // Get the created games' IDs
        createdGames = await tx.game.findMany({
          where: { externalId: { in: gamesToCreate.map((g) => g.id) } },
          select: { id: true, externalId: true },
        });
        processedCount += createdGames.length;
      }

      // Step 5: Update the game map with newly created games
      for (const game of createdGames) {
        existingGameMap.set(game.externalId!, game.id);
      }

      // Step 6: Delete all old odds for these games in batch
      const allGameIds = Array.from(existingGameMap.values());
      await tx.odds.deleteMany({
        where: { gameId: { in: allGameIds } },
      });

      // Step 7: Prepare and batch insert all new odds
      const oddsToCreate: Array<{
        gameId: string;
        bookmaker: string;
        market: string;
        homeOdds: number | undefined;
        awayOdds: number | undefined;
        drawOdds: number | undefined;
        lastUpdate: Date;
      }> = [];

      for (const gameData of gamesData) {
        const gameId = existingGameMap.get(gameData.id);
        if (!gameId || !gameData.bookmakers) continue;

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

          oddsToCreate.push({
            gameId,
            bookmaker: bookmaker.key,
            market: 'h2h',
            homeOdds: homeOutcome?.price,
            awayOdds: awayOutcome?.price,
            drawOdds: drawOutcome?.price,
            lastUpdate: new Date(),
          });
        }
      }

      // Step 8: Batch insert all odds
      if (oddsToCreate.length > 0) {
        await tx.odds.createMany({
          data: oddsToCreate,
        });
      }

      this.logger.debug(
        `Batch upserted ${processedCount} games with ${oddsToCreate.length} odds records`,
      );

      return processedCount;
    });
  }

  async findAll(
    status?: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = calculatePagination(paginationQuery);

    const where = status ? { status: status as GameStatus } : {};

    const [total, games] = await Promise.all([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        include: {
          odds: true,
        },
        orderBy: {
          startTime: 'asc',
        },
        skip,
        take: limit,
      }),
    ]);

    return new PaginatedResponseDto(games, total, page, limit);
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

    // TODO Commented out for demo purposes - normally would check if game started
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
