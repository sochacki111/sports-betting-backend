import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma/prisma.service';
import { OddsClientService } from '../odds-client/odds-client.service';
import { UsersService } from '../users/users.service';
import { BetStrategyFactory } from './strategies/bet-strategy.factory';
import { PlaceBetDto, BetTypeEnum, SelectionEnum } from './dto/place-bet.dto';
import { BetStatus, BetResult, BetType } from '@prisma/betting-client';

describe('BetsService', () => {
  let service: BetsService;
  let prismaService: PrismaService;
  let oddsClientService: OddsClientService;
  let usersService: UsersService;

  const mockPrismaService = {
    bet: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockOddsClientService = {
    validateGame: jest.fn(),
    getGameOdds: jest.fn(),
    getGamesByIds: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockStrategyFactory = {
    getStrategy: jest.fn().mockReturnValue({
      calculatePotentialWin: jest.fn((amount, odds) => amount * odds),
      settleBet: jest.fn(),
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        MIN_BET_AMOUNT: 1,
        MAX_BET_AMOUNT: 500,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OddsClientService, useValue: mockOddsClientService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: BetStrategyFactory, useValue: mockStrategyFactory },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BetsService>(BetsService);
    prismaService = module.get<PrismaService>(PrismaService);
    oddsClientService = module.get<OddsClientService>(OddsClientService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('placeBet', () => {
    const placeBetDto: PlaceBetDto = {
      userId: 'user-123',
      gameId: 'game-123',
      betType: BetTypeEnum.MONEYLINE,
      selection: SelectionEnum.HOME,
      amount: 100,
    };

    it('should successfully place a bet', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', balance: 1000 };
      const mockGameValidation = { isValid: true, message: 'Valid game' };
      const mockGameOdds = {
        success: true,
        gameOdds: { homeOdds: 2.5, awayOdds: 1.8, drawOdds: 3.0 },
      };
      const mockBet = {
        id: 'bet-123',
        ...placeBetDto,
        odds: 2.5,
        potentialWin: 250,
        status: 'PENDING',
      };

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockOddsClientService.validateGame.mockResolvedValue(mockGameValidation);
      mockOddsClientService.getGameOdds.mockResolvedValue(mockGameOdds);
      mockPrismaService.bet.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );
      mockPrismaService.bet.create.mockResolvedValue(mockBet);

      const result = await service.placeBet(placeBetDto);

      expect(result).toEqual(mockBet);
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-123');
      expect(mockOddsClientService.validateGame).toHaveBeenCalledWith('game-123');
    });

    it('should throw BadRequestException when bet amount is below minimum', async () => {
      const invalidDto = { ...placeBetDto, amount: 0.5 };

      await expect(service.placeBet(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when bet amount exceeds maximum', async () => {
      const invalidDto = { ...placeBetDto, amount: 1000 };

      await expect(service.placeBet(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user has insufficient balance', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', balance: 50 };
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(service.placeBet(placeBetDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw ConflictException when duplicate bet exists', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', balance: 1000 };
      const mockGameValidation = { isValid: true, message: 'Valid game' };
      const existingBet = { id: 'existing-bet-123' };

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockOddsClientService.validateGame.mockResolvedValue(mockGameValidation);
      mockPrismaService.bet.findUnique.mockResolvedValue(existingBet);

      await expect(service.placeBet(placeBetDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when game is not valid for betting', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', balance: 1000 };
      const mockGameValidation = {
        isValid: false,
        message: 'Game has already started',
      };

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockOddsClientService.validateGame.mockResolvedValue(mockGameValidation);

      await expect(service.placeBet(placeBetDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('settleBets', () => {
    const gameId = 'game-123';

    it('should successfully settle bets for a finished game with winners', async () => {
      const mockGame = {
        id: gameId,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        status: 'FINISHED',
        homeScore: 110,
        awayScore: 95,
      };

      const mockPendingBets = [
        {
          id: 'bet-1',
          userId: 'user-1',
          gameId,
          betType: BetType.MONEYLINE,
          selection: 'home',
          amount: 100,
          odds: 1.85,
          potentialWin: 185,
          status: BetStatus.PENDING,
        },
        {
          id: 'bet-2',
          userId: 'user-2',
          gameId,
          betType: BetType.MONEYLINE,
          selection: 'away',
          amount: 50,
          odds: 2.1,
          potentialWin: 105,
          status: BetStatus.PENDING,
        },
      ];

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });
      mockPrismaService.bet.findMany.mockResolvedValue(mockPendingBets);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );

      mockStrategyFactory.getStrategy.mockReturnValue({
        settleBet: jest
          .fn()
          .mockReturnValueOnce({ result: 'WON' })
          .mockReturnValueOnce({ result: 'LOST' }),
      });

      mockPrismaService.bet.update.mockResolvedValueOnce({
        ...mockPendingBets[0],
        status: BetStatus.SETTLED,
        result: BetResult.WON,
      });
      mockPrismaService.bet.update.mockResolvedValueOnce({
        ...mockPendingBets[1],
        status: BetStatus.SETTLED,
        result: BetResult.LOST,
      });

      const result = await service.settleBets(gameId);

      expect(result.settledBets).toHaveLength(2);
      expect(result.message).toContain('Settled 2 bets');
      expect(mockOddsClientService.getGamesByIds).toHaveBeenCalledWith([gameId]);
      expect(mockPrismaService.bet.findMany).toHaveBeenCalledWith({
        where: {
          gameId,
          status: BetStatus.PENDING,
        },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should handle PUSH result and return original stake', async () => {
      const mockGame = {
        id: gameId,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        status: 'FINISHED',
        homeScore: 100,
        awayScore: 100,
      };

      const mockBet = {
        id: 'bet-1',
        userId: 'user-1',
        gameId,
        betType: BetType.MONEYLINE,
        selection: 'home',
        amount: 100,
        odds: 1.85,
        potentialWin: 185,
        status: BetStatus.PENDING,
      };

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });
      mockPrismaService.bet.findMany.mockResolvedValue([mockBet]);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );

      mockStrategyFactory.getStrategy.mockReturnValue({
        settleBet: jest.fn().mockReturnValue({ result: 'PUSH' }),
      });

      mockPrismaService.bet.update.mockResolvedValue({
        ...mockBet,
        status: BetStatus.SETTLED,
        result: BetResult.PUSH,
      });

      await service.settleBets(gameId);

      // Verify user gets back original stake (100)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          balance: {
            increment: 100, // Original stake returned
          },
        },
      });
    });

    it('should throw NotFoundException when game not found', async () => {
      mockOddsClientService.getGamesByIds.mockResolvedValue({ games: [] });

      await expect(service.settleBets(gameId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.bet.findMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when game is not finished', async () => {
      const mockGame = {
        id: gameId,
        status: 'UPCOMING',
      };

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });

      await expect(service.settleBets(gameId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.bet.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when no pending bets found', async () => {
      const mockGame = {
        id: gameId,
        status: 'FINISHED',
        homeScore: 100,
        awayScore: 95,
      };

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });
      mockPrismaService.bet.findMany.mockResolvedValue([]);

      const result = await service.settleBets(gameId);

      expect(result.settledBets).toEqual([]);
      expect(result.message).toContain('Settled 0 bets');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should update bet status to SETTLED and increment user balance for won bets', async () => {
      const mockGame = {
        id: gameId,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        status: 'FINISHED',
        homeScore: 110,
        awayScore: 95,
      };

      const mockBet = {
        id: 'bet-1',
        userId: 'user-1',
        gameId,
        betType: BetType.MONEYLINE,
        selection: 'home',
        amount: 100,
        odds: 1.85,
        potentialWin: 185,
        status: BetStatus.PENDING,
      };

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });
      mockPrismaService.bet.findMany.mockResolvedValue([mockBet]);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );

      mockStrategyFactory.getStrategy.mockReturnValue({
        settleBet: jest.fn().mockReturnValue({ result: 'WON' }),
      });

      mockPrismaService.bet.update.mockResolvedValue({
        ...mockBet,
        status: BetStatus.SETTLED,
        result: BetResult.WON,
      });

      await service.settleBets(gameId);

      // Verify bet was updated
      expect(mockPrismaService.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: expect.objectContaining({
          status: BetStatus.SETTLED,
          result: BetResult.WON,
        }),
      });

      // Verify user balance was incremented with potentialWin (185)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          balance: {
            increment: 185,
          },
        },
      });
    });

    it('should not increment balance for lost bets', async () => {
      const mockGame = {
        id: gameId,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        status: 'FINISHED',
        homeScore: 95,
        awayScore: 110,
      };

      const mockBet = {
        id: 'bet-1',
        userId: 'user-1',
        gameId,
        betType: BetType.MONEYLINE,
        selection: 'home',
        amount: 100,
        odds: 1.85,
        potentialWin: 185,
        status: BetStatus.PENDING,
      };

      mockOddsClientService.getGamesByIds.mockResolvedValue({
        games: [mockGame],
      });
      mockPrismaService.bet.findMany.mockResolvedValue([mockBet]);
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );

      mockStrategyFactory.getStrategy.mockReturnValue({
        settleBet: jest.fn().mockReturnValue({ result: 'LOST' }),
      });

      mockPrismaService.bet.update.mockResolvedValue({
        ...mockBet,
        status: BetStatus.SETTLED,
        result: BetResult.LOST,
      });

      await service.settleBets(gameId);

      // Verify user balance was not incremented (payout = 0 means no user.update call)
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllBetsByUser', () => {
    it('should return all bets for a user', async () => {
      const userId = 'user-123';
      const mockBets = [
        { id: 'bet-1', userId, gameId: 'game-1' },
        { id: 'bet-2', userId, gameId: 'game-2' },
      ];

      mockPrismaService.bet.findMany.mockResolvedValue(mockBets);

      const result = await service.findAllBetsByUser(userId);

      expect(result).toEqual(mockBets);
      expect(mockPrismaService.bet.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
