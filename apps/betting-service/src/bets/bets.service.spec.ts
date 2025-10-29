import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma/prisma.service';
import { OddsClientService } from '../odds-client/odds-client.service';
import { UsersService } from '../users/users.service';
import { BetStrategyFactory } from './strategies/bet-strategy.factory';
import { PlaceBetDto, BetTypeEnum, SelectionEnum } from './dto/place-bet.dto';

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
});
