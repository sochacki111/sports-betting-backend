import { Module } from '@nestjs/common';
import { GameEventsController } from './game-events.controller';
import { BetsModule } from '../bets/bets.module';

@Module({
  imports: [BetsModule],
  controllers: [GameEventsController],
})
export class EventsModule {}
