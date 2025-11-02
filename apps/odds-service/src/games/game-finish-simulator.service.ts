import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus } from '@prisma/odds-client';

@Injectable()
export class GameFinishSimulatorService {
  private readonly logger = new Logger(GameFinishSimulatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 */5 * * * *', {
    name: 'auto-finish-games',
  })
  async handleAutoFinishGames(): Promise<void> {
    const hoursThreshold = this.configService.get<number>(
      'gameFinishSimulator.hoursThreshold',
      3,
    );

    this.logger.log(
      `Running game finish simulator (threshold: ${hoursThreshold}h)`,
    );

    try {
      // Calculate threshold date
      const thresholdDate = new Date();
      thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);

      // Find LIVE games older than threshold
      const gamesToFinish = await this.prisma.game.findMany({
        where: {
          status: GameStatus.LIVE,
          startTime: {
            lt: thresholdDate,
          },
        },
      });

      if (gamesToFinish.length === 0) {
        this.logger.log('No LIVE games found to auto-finish');
        return;
      }

      this.logger.log(`Found ${gamesToFinish.length} games to auto-finish`);

      // Update games to FINISHED status (without scores - Phase 2 will handle that)
      const gameIds = gamesToFinish.map((game) => game.id);

      const result = await this.prisma.game.updateMany({
        where: {
          id: { in: gameIds },
          status: GameStatus.LIVE, // Additional safety check
        },
        data: {
          status: GameStatus.FINISHED,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Successfully auto-finished ${result.count} games. IDs: ${gameIds.join(', ')}`,
      );

      // Phase 2: This is where we'll emit RabbitMQ event
      // TODO: Emit 'game.finished' event for each game
    } catch (error) {
      this.logger.error('Error auto-finishing games', error);
    }
  }
}
