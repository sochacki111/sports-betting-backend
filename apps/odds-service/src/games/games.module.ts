import { Module, Provider } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GameFinishSimulatorService } from './game-finish-simulator.service';

const providers: Provider[] = [GamesService];

// Conditionally add GameFinishSimulatorService based on environment
if (process.env.ENABLE_GAME_FINISH_SIMULATOR === 'true') {
  providers.push(GameFinishSimulatorService);
}

@Module({
  controllers: [GamesController],
  providers,
  exports: [GamesService],
})
export class GamesModule {}
