import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bet: {
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'DEFAULT_USER_BALANCE') {
        return '1000';
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('createMockUsers', () => {
    it('should create mock users with default balance', async () => {
      mockPrismaService.user.upsert.mockResolvedValue({});

      await service.createMockUsers();

      expect(mockPrismaService.user.upsert).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
        where: { username: 'john_doe' },
        update: {},
        create: { username: 'john_doe', balance: 1000 },
      });
      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
        where: { username: 'jane_smith' },
        update: {},
        create: { username: 'jane_smith', balance: 1000 },
      });
      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
        where: { username: 'bob_jones' },
        update: {},
        create: { username: 'bob_jones', balance: 1000 },
      });
    });

    it('should use custom default balance from config', async () => {
      mockConfigService.get.mockReturnValue('2000');
      mockPrismaService.user.upsert.mockResolvedValue({});

      await service.createMockUsers();

      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ balance: 2000 }),
        }),
      );
    });

    it('should handle upsert for existing users', async () => {
      mockPrismaService.user.upsert.mockResolvedValue({
        id: 'existing-user',
        username: 'john_doe',
        balance: 500,
      });

      await service.createMockUsers();

      // Verify that upsert was called with update: {} (no changes for existing users)
      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1000,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'User with ID non-existent-id not found',
      );
    });
  });

  describe('getUserStatus', () => {
    it('should return user status with stats and bets', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1200,
      };

      const mockBets = [
        {
          id: 'bet-1',
          userId: 'user-123',
          amount: 100,
          potentialWin: 185,
          status: 'SETTLED',
          result: 'WON',
        },
        {
          id: 'bet-2',
          userId: 'user-123',
          amount: 50,
          potentialWin: 105,
          status: 'SETTLED',
          result: 'LOST',
        },
        {
          id: 'bet-3',
          userId: 'user-123',
          amount: 75,
          potentialWin: 150,
          status: 'PENDING',
          result: 'PENDING',
        },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.bet.findMany.mockResolvedValue(mockBets);

      const result = await service.getUserStatus('user-123');

      expect(result.user).toEqual({
        id: 'user-123',
        username: 'john_doe',
        balance: 1200,
      });
      expect(result.stats).toEqual({
        totalBets: 3,
        pendingBets: 1,
        wonBets: 1,
        lostBets: 1,
        totalWagered: 225, // 100 + 50 + 75
        totalWon: 185, // Only WON bets
      });
      expect(result.bets).toEqual(mockBets);
    });

    it('should return empty stats when user has no bets', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1000,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.bet.findMany.mockResolvedValue([]);

      const result = await service.getUserStatus('user-123');

      expect(result.stats).toEqual({
        totalBets: 0,
        pendingBets: 0,
        wonBets: 0,
        lostBets: 0,
        totalWagered: 0,
        totalWon: 0,
      });
      expect(result.bets).toEqual([]);
    });

    it('should calculate stats correctly for multiple won bets', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 2000,
      };

      const mockBets = [
        {
          id: 'bet-1',
          userId: 'user-123',
          amount: 100,
          potentialWin: 200,
          status: 'SETTLED',
          result: 'WON',
        },
        {
          id: 'bet-2',
          userId: 'user-123',
          amount: 150,
          potentialWin: 300,
          status: 'SETTLED',
          result: 'WON',
        },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.bet.findMany.mockResolvedValue(mockBets);

      const result = await service.getUserStatus('user-123');

      expect(result.stats.wonBets).toBe(2);
      expect(result.stats.totalWon).toBe(500); // 200 + 300
      expect(result.stats.totalWagered).toBe(250); // 100 + 150
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should order bets by createdAt desc', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1000,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.bet.findMany.mockResolvedValue([]);

      await service.getUserStatus('user-123');

      expect(mockPrismaService.bet.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateBalance', () => {
    it('should increment user balance', async () => {
      const updatedUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1500,
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateBalance('user-123', 500);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          balance: {
            increment: 500,
          },
        },
      });
    });

    it('should decrement user balance with negative amount', async () => {
      const updatedUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 800,
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateBalance('user-123', -200);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          balance: {
            increment: -200,
          },
        },
      });
    });

    it('should handle zero amount', async () => {
      const updatedUser = {
        id: 'user-123',
        username: 'john_doe',
        balance: 1000,
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateBalance('user-123', 0);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          balance: {
            increment: 0,
          },
        },
      });
    });
  });
});
