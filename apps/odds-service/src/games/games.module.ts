import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GameFinishSimulatorService } from './game-finish-simulator.service';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RabbitmqModule],
  controllers: [GamesController],
  providers: [GamesService, GameFinishSimulatorService],
  exports: [GamesService],
})
export class GamesModule {}
