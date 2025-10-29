import { MoneylineStrategy } from './moneyline.strategy';

describe('MoneylineStrategy', () => {
  let strategy: MoneylineStrategy;

  beforeEach(() => {
    strategy = new MoneylineStrategy();
  });

  describe('calculatePotentialWin', () => {
    it('should calculate potential win correctly', () => {
      expect(strategy.calculatePotentialWin(100, 2.5)).toBe(250);
      expect(strategy.calculatePotentialWin(50, 1.8)).toBe(90);
      expect(strategy.calculatePotentialWin(200, 3.0)).toBe(600);
    });
  });

  describe('settleBet', () => {
    it('should return WON when home is selected and home wins', () => {
      const result = strategy.settleBet({
        selection: 'home',
        homeScore: 3,
        awayScore: 1,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('WON');
      expect(result.message).toContain('Team A won');
    });

    it('should return WON when away is selected and away wins', () => {
      const result = strategy.settleBet({
        selection: 'away',
        homeScore: 1,
        awayScore: 3,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('WON');
      expect(result.message).toContain('Team B won');
    });

    it('should return LOST when home is selected and away wins', () => {
      const result = strategy.settleBet({
        selection: 'home',
        homeScore: 1,
        awayScore: 3,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('LOST');
    });

    it('should return LOST when away is selected and home wins', () => {
      const result = strategy.settleBet({
        selection: 'away',
        homeScore: 3,
        awayScore: 1,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('LOST');
    });

    it('should return WON when draw is selected and game is draw', () => {
      const result = strategy.settleBet({
        selection: 'draw',
        homeScore: 2,
        awayScore: 2,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('WON');
      expect(result.message).toContain('draw');
    });

    it('should return PUSH when game is draw and draw not selected', () => {
      const result = strategy.settleBet({
        selection: 'home',
        homeScore: 2,
        awayScore: 2,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
      });
      expect(result.result).toBe('PUSH');
      expect(result.message).toContain('pushed');
    });
  });
});
