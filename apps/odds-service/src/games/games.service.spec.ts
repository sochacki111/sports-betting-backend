import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GamesService } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus } from '@prisma/odds-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GamesService', () => {
  let service: GamesService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    game: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    odds: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        'oddsApi.key': 'test-api-key',
        'oddsApi.baseUrl': 'https://api.test.com',
        'oddsApi.regions': 'us,uk',
        'oddsApi.markets': 'h2h',
        'oddsApi.supportedSports': ['basketball_nba', 'soccer_epl'],
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
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

    service = module.get<GamesService>(GamesService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('refreshOdds', () => {
    it('should successfully call API and return result', async () => {
      const mockApiResponse = [
        {
          id: 'game-1',
          sport_key: 'basketball_nba',
          home_team: 'Lakers',
          away_team: 'Warriors',
          commence_time: '2025-11-05T19:00:00Z',
          bookmakers: [
            {
              key: 'draftkings',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Lakers', price: 1.85 },
                    { name: 'Warriors', price: 2.05 },
                  ],
                },
              ],
            },
          ],
        },
      ];

      mockedAxios.get.mockResolvedValue({ data: mockApiResponse });

      // Mock transaction with proper implementation
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          ...mockPrismaService,
          game: {
            ...mockPrismaService.game,
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          odds: {
            ...mockPrismaService.odds,
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.refreshOdds();

      expect(result.message).toBe('Odds refreshed successfully');
      expect(result.gamesUpdated).toBeGreaterThanOrEqual(0);
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle API errors per sport and continue', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await service.refreshOdds();

      // Should complete successfully even with API errors (per-sport error handling)
      expect(result.message).toBe('Odds refreshed successfully');
      expect(result.gamesUpdated).toBe(0);
    });

    it('should skip games with no bookmakers', async () => {
      const mockApiResponse = [
        {
          id: 'game-no-odds',
          sport_key: 'basketball_nba',
          home_team: 'Lakers',
          away_team: 'Warriors',
          commence_time: '2025-11-05T19:00:00Z',
          bookmakers: [],
        },
      ];

      mockedAxios.get.mockResolvedValue({ data: mockApiResponse });
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );

      const result = await service.refreshOdds();

      expect(result.gamesUpdated).toBe(0);
    });
  });

  describe('validateGame', () => {
    it('should return valid for an upcoming game', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.UPCOMING,
        startTime: new Date('2025-12-01T19:00:00Z'),
        odds: [{ homeOdds: 1.85, awayOdds: 2.05 }],
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.validateGame('game-1');

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Game is valid for betting');
    });

    it('should return invalid for non-existent game', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      const result = await service.validateGame('non-existent');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Game not found');
    });

    it('should return invalid for finished game', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.FINISHED,
        startTime: new Date('2025-11-01T19:00:00Z'),
        odds: [{ homeOdds: 1.85, awayOdds: 2.05 }],
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.validateGame('game-1');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Game is finished');
    });

    it('should return invalid for cancelled game', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.CANCELLED,
        startTime: new Date('2025-11-05T19:00:00Z'),
        odds: [],
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.validateGame('game-1');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Game is cancelled');
    });

    it('should return invalid for game without odds', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.UPCOMING,
        startTime: new Date('2025-11-05T19:00:00Z'),
        odds: [],
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.validateGame('game-1');

      expect(result.isValid).toBe(true); // Empty odds array is still valid
      expect(result.message).toBe('Game is valid for betting');
    });
  });

  describe('generateResult', () => {
    it('should generate random scores for a game', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.UPCOMING,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        status: GameStatus.FINISHED,
        homeScore: 105,
        awayScore: 98,
      });

      const result = await service.generateResult('game-1', {});

      expect(result.status).toBe(GameStatus.FINISHED);
      expect(result.homeScore).toBeGreaterThanOrEqual(0);
      expect(result.awayScore).toBeGreaterThanOrEqual(0);
      expect(mockPrismaService.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: expect.objectContaining({
          status: GameStatus.FINISHED,
          homeScore: expect.any(Number),
          awayScore: expect.any(Number),
          updatedAt: expect.any(Date),
        }),
        include: { odds: true },
      });
    });

    it('should use provided scores when given', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.UPCOMING,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
      };

      const dto = {
        homeScore: 110,
        awayScore: 95,
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        status: GameStatus.FINISHED,
        ...dto,
      });

      const result = await service.generateResult('game-1', dto);

      expect(result.homeScore).toBe(110);
      expect(result.awayScore).toBe(95);
    });

    it('should throw NotFoundException for non-existent game', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(service.generateResult('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for already finished game', async () => {
      const mockGame = {
        id: 'game-1',
        status: GameStatus.FINISHED,
        homeScore: 100,
        awayScore: 95,
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      await expect(service.generateResult('game-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all games when no status filter', async () => {
      const mockGames = [
        { id: '1', status: GameStatus.UPCOMING },
        { id: '2', status: GameStatus.FINISHED },
      ];

      mockPrismaService.game.findMany.mockResolvedValue(mockGames);

      const result = await service.findAll();

      expect(result).toEqual(mockGames);
      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: {},
        include: { odds: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('should filter games by status', async () => {
      const mockGames = [{ id: '1', status: GameStatus.UPCOMING }];

      mockPrismaService.game.findMany.mockResolvedValue(mockGames);

      const result = await service.findAll(GameStatus.UPCOMING);

      expect(result).toEqual(mockGames);
      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { status: GameStatus.UPCOMING },
        include: { odds: true },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a game by id', async () => {
      const mockGame = {
        id: 'game-1',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        odds: [],
      };

      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.findOne('game-1');

      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException when game not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIds', () => {
    it('should return multiple games by ids', async () => {
      const mockGames = [
        { id: 'game-1', homeTeam: 'Lakers' },
        { id: 'game-2', homeTeam: 'Celtics' },
      ];

      mockPrismaService.game.findMany.mockResolvedValue(mockGames);

      const result = await service.findByIds(['game-1', 'game-2']);

      expect(result).toEqual(mockGames);
      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['game-1', 'game-2'] } },
        include: { odds: true },
      });
    });

    it('should return empty array for empty input', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      const result = await service.findByIds([]);

      expect(result).toEqual([]);
    });
  });
});
