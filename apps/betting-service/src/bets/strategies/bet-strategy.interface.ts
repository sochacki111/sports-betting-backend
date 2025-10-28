export interface BetResult {
  result: 'WON' | 'LOST' | 'PUSH';
  message: string;
}

export interface BetStrategy {
  calculatePotentialWin(amount: number, odds: number): number;

  settleBet(
    selection: string,
    homeScore: number,
    awayScore: number,
    homeTeam: string,
    awayTeam: string,
  ): BetResult;
}
