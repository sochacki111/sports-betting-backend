import { Injectable } from '@nestjs/common';
import { BetStrategy, BetResult, BetContext } from './bet-strategy.interface';

@Injectable()
export class MoneylineStrategy implements BetStrategy {
  calculatePotentialWin(amount: number, odds: number): number {
    // For decimal odds: potentialWin = amount * odds
    return amount * odds;
  }

  settleBet(context: BetContext): BetResult {
    const { selection, homeScore, awayScore, homeTeam, awayTeam } = context;
    let result: 'WON' | 'LOST' | 'PUSH';
    let message: string;

    if (homeScore === awayScore) {
      // Draw
      if (selection.toLowerCase() === 'draw') {
        result = 'WON';
        message = 'Bet won - game ended in a draw';
      } else {
        result = 'PUSH';
        message = 'Bet pushed - game ended in a draw';
      }
    } else if (homeScore > awayScore) {
      // Home win
      if (selection.toLowerCase() === 'home') {
        result = 'WON';
        message = `Bet won - ${homeTeam} won`;
      } else {
        result = 'LOST';
        message = `Bet lost - ${homeTeam} won`;
      }
    } else {
      // Away win
      if (selection.toLowerCase() === 'away') {
        result = 'WON';
        message = `Bet won - ${awayTeam} won`;
      } else {
        result = 'LOST';
        message = `Bet lost - ${awayTeam} won`;
      }
    }

    return { result, message };
  }
}
