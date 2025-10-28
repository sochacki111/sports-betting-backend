import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OddsClientService } from '../odds-client/odds-client.service';
import { UsersService } from '../users/users.service';
import { BetStrategyFactory } from './strategies/bet-strategy.factory';
import { PlaceBetDto } from './dto/place-bet.dto';
import { BetStatus, BetResult, BetType } from '@prisma/betting-client';

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);
  private readonly minBetAmount: number;
  private readonly maxBetAmount: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oddsClient: OddsClientService,
    private readonly usersService: UsersService,
    private readonly strategyFactory: BetStrategyFactory,
    private readonly configService: ConfigService,
  ) {
    this.minBetAmount = this.configService.get<number>('MIN_BET_AMOUNT', 1);
    this.maxBetAmount = this.configService.get<number>('MAX_BET_AMOUNT', 500);
  }

  async placeBet(placeBetDto: PlaceBetDto) {
    this.logger.log(
      `Placing bet for user ${placeBetDto.userId} on game ${placeBetDto.gameId}`,
    );

    // 1. Validate bet amount limits
    this.validateBetAmount(placeBetDto.amount);

    // 2. Get user and validate balance
    const user = await this.usersService.findById(placeBetDto.userId);
    if (user.balance < placeBetDto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${user.balance}, Required: ${placeBetDto.amount}`,
      );
    }

    // 3. Validate game via gRPC
    const gameValidation: any = await this.oddsClient.validateGame(
      placeBetDto.gameId,
    );
    if (!gameValidation.isValid) {
      throw new BadRequestException(
        `Cannot place bet: ${gameValidation.message}`,
      );
    }

    // 4. Check for duplicate bet (same user, game, selection)
    const existingBet = await this.prisma.bet.findUnique({
      where: {
        userId_gameId_selection: {
          userId: placeBetDto.userId,
          gameId: placeBetDto.gameId,
          selection: placeBetDto.selection,
        },
      },
    });

    if (existingBet) {
      throw new ConflictException(
        'You have already placed a bet with this selection for this game',
      );
    }

    // 5. Get odds from Odds Service via gRPC
    const gameOddsResponse: any = await this.oddsClient.getGameOdds(
      placeBetDto.gameId,
    );
    if (!gameOddsResponse.success) {
      throw new BadRequestException('Failed to retrieve game odds');
    }

    const gameOdds = gameOddsResponse.gameOdds;

    // 6. Determine odds based on selection
    let odds: number;
    switch (placeBetDto.selection.toLowerCase()) {
      case 'home':
        odds = gameOdds.homeOdds;
        break;
      case 'away':
        odds = gameOdds.awayOdds;
        break;
      case 'draw':
        odds = gameOdds.drawOdds;
        break;
      default:
        throw new BadRequestException('Invalid selection');
    }

    // 7. Calculate potential win using strategy pattern
    const strategy = this.strategyFactory.getStrategy(placeBetDto.betType);
    const potentialWin = strategy.calculatePotentialWin(
      placeBetDto.amount,
      odds,
    );

    // 8. Start transaction: create bet and deduct balance
    const bet = await this.prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: placeBetDto.userId },
        data: {
          balance: {
            decrement: placeBetDto.amount,
          },
        },
      });

      // Create bet
      return tx.bet.create({
        data: {
          userId: placeBetDto.userId,
          gameId: placeBetDto.gameId,
          betType: placeBetDto.betType as BetType,
          selection: placeBetDto.selection,
          amount: placeBetDto.amount,
          odds,
          potentialWin,
          status: BetStatus.PENDING,
          result: BetResult.PENDING,
        },
      });
    });

    this.logger.log(`Bet placed successfully: ${bet.id}`);
    return bet;
  }

  async findAllBetsByUser(userId: string) {
    return this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async settleBets(gameId: string) {
    this.logger.log(`Settling bets for game ${gameId}`);

    // Get game details from Odds Service
    const gameData: any = await this.oddsClient.getGamesByIds([gameId]);
    if (!gameData.games || gameData.games.length === 0) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    const game = gameData.games[0];

    if (game.status !== 'FINISHED') {
      throw new BadRequestException('Game is not finished yet');
    }

    // Get all pending bets for this game
    const pendingBets = await this.prisma.bet.findMany({
      where: {
        gameId,
        status: BetStatus.PENDING,
      },
    });

    this.logger.log(`Found ${pendingBets.length} pending bets to settle`);

    const settledBets = [];

    for (const bet of pendingBets) {
      const strategy = this.strategyFactory.getStrategy(bet.betType);
      const settlementResult = strategy.settleBet(
        bet.selection,
        game.homeScore,
        game.awayScore,
        game.homeTeam,
        game.awayTeam,
      );

      // Calculate payout
      let payout = 0;
      if (settlementResult.result === 'WON') {
        payout = bet.potentialWin;
      } else if (settlementResult.result === 'PUSH') {
        payout = bet.amount; // Return original stake
      }

      // Update bet and user balance in transaction
      const updatedBet = await this.prisma.$transaction(async (tx) => {
        // Update bet status
        const settled = await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: BetStatus.SETTLED,
            result: settlementResult.result as BetResult,
            settledAt: new Date(),
          },
        });

        // Update user balance if won or pushed
        if (payout > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: {
              balance: {
                increment: payout,
              },
            },
          });
        }

        return settled;
      });

      settledBets.push({
        ...updatedBet,
        message: settlementResult.message,
        payout,
      });

      this.logger.log(
        `Bet ${bet.id} settled: ${settlementResult.result} (payout: ${payout})`,
      );
    }

    return {
      message: `Settled ${settledBets.length} bets for game ${gameId}`,
      settledBets,
    };
  }

  private validateBetAmount(amount: number): void {
    if (amount < this.minBetAmount) {
      throw new BadRequestException(
        `Bet amount must be at least ${this.minBetAmount}`,
      );
    }

    if (amount > this.maxBetAmount) {
      throw new BadRequestException(
        `Bet amount must not exceed ${this.maxBetAmount}`,
      );
    }
  }
}
