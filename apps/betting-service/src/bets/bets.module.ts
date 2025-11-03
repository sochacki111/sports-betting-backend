import { Module } from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { UsersModule } from '../users/users.module';
import { MoneylineStrategy } from './strategies/moneyline.strategy';
import { BetStrategyFactory } from './strategies/bet-strategy.factory';

@Module({
  imports: [UsersModule],
  controllers: [BetsController],
  providers: [BetsService, MoneylineStrategy, BetStrategyFactory],
  exports: [BetsService],
})
export class BetsModule {}
