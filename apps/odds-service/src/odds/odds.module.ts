import { Module } from '@nestjs/common';
import { OddsController } from './odds.controller';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [GamesModule],
  controllers: [OddsController],
})
export class OddsModule {}
