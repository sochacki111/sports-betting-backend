import { Module } from '@nestjs/common';
import { GameEventsController } from './game-events.controller';

@Module({
  controllers: [GameEventsController],
})
export class EventsModule {}
