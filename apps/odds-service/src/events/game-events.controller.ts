import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { GameFinishedEvent, GAME_FINISHED_EVENT } from './game-finished.event';

@Controller()
export class GameEventsController {
  private readonly logger = new Logger(GameEventsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @EventPattern(GAME_FINISHED_EVENT)
  async handleGameFinished(@Payload() event: GameFinishedEvent) {
    this.logger.log(
      `Received ${GAME_FINISHED_EVENT} event for game ${event.gameId}`,
    );

    try {
      // Generate random scores
      const homeScore = Math.floor(Math.random() * 120) + 80;
      const awayScore = Math.floor(Math.random() * 120) + 80;

      await this.prisma.game.update({
        where: { id: event.gameId },
        data: {
          homeScore,
          awayScore,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Generated scores for game ${event.gameId}: ${event.homeTeam} ${homeScore} - ${awayScore} ${event.awayTeam}`,
      );
    } catch (error) {
      this.logger.error(
        `Error generating scores for game ${event.gameId}`,
        error,
      );
    }
  }
}
