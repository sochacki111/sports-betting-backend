import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { GameFinishedEvent, GAME_FINISHED_EVENT } from './game-finished.event';
import { BetsService } from '../bets/bets.service';

@Controller()
export class GameEventsController {
  private readonly logger = new Logger(GameEventsController.name);

  constructor(private readonly betsService: BetsService) {}

  @EventPattern(GAME_FINISHED_EVENT)
  async handleGameFinished(@Payload() event: GameFinishedEvent) {
    this.logger.log(
      `Received ${GAME_FINISHED_EVENT} event for game ${event.gameId}`,
    );

    try {
      await this.betsService.settleBets(event.gameId);

      this.logger.log(`Successfully settled bets for game ${event.gameId}`);
    } catch (error) {
      this.logger.error(
        `Error settling bets for game ${event.gameId}`,
        error,
      );
    }
  }
}
