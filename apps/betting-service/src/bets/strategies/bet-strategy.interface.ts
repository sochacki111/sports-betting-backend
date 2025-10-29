export interface BetResult {
  result: 'WON' | 'LOST' | 'PUSH';
  message: string;
}

export interface BetContext {
  selection: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  // Optional parameters for different bet types
  spread?: number; // for spread bets (e.g., -3.5)
  totalLine?: number; // for over/under bets (e.g., 45.5)
  odds?: number; // if needed for settlement logic
}

export interface BetStrategy {
  calculatePotentialWin(amount: number, odds: number): number;

  settleBet(context: BetContext): BetResult;
}
