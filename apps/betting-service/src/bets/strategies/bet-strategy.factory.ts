import { Injectable } from '@nestjs/common';
import { BetStrategy } from './bet-strategy.interface';
import { MoneylineStrategy } from './moneyline.strategy';

@Injectable()
export class BetStrategyFactory {
  constructor(private readonly moneylineStrategy: MoneylineStrategy) {}

  getStrategy(betType: string): BetStrategy {
    switch (betType.toUpperCase()) {
      case 'MONEYLINE':
        return this.moneylineStrategy;
      // Future: Add more strategies here
      // case 'SPREAD':
      //   return this.spreadStrategy;
      // case 'OVER_UNDER':
      //   return this.overUnderStrategy;
      default:
        return this.moneylineStrategy;
    }
  }
}
