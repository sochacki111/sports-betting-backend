import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { GameFinishSimulatorService } from './game-finish-simulator.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus } from '@prisma/odds-client';
import { GAME_FINISHED_EVENT } from '../events/game-finished.event';

describe('GameFinishSimulatorService', () => {
  let service: GameFinishSimulatorService;
  let prisma: PrismaService;
  let rabbitClient: ClientProxy;
  let configService: ConfigService;

  const mockPrismaService = {
    game: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockRabbitClient = {
    emit: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'gameFinishSimulator.hoursThreshold') {
        return 3;
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameFinishSimulatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'RABBITMQ_SERVICE',
          useValue: mockRabbitClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GameFinishSimulatorService>(
      GameFinishSimulatorService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    rabbitClient = module.get<ClientProxy>('RABBITMQ_SERVICE');
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('handleAutoFinishGames', () => {
    it('should finish LIVE games older than threshold and emit events', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 5); // 5 hours ago (older than 3h threshold)

      const mockGamesToFinish = [
        {
          id: 'game-1',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: oldDate,
          status: GameStatus.LIVE,
        },
        {
          id: 'game-2',
          homeTeam: 'Celtics',
          awayTeam: 'Heat',
          startTime: oldDate,
          status: GameStatus.LIVE,
        },
      ];

      mockPrismaService.game.findMany.mockResolvedValue(mockGamesToFinish);
      mockPrismaService.game.updateMany.mockResolvedValue({ count: 2 });

      await service.handleAutoFinishGames();

      // Verify database query for old LIVE games
      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: {
          status: GameStatus.LIVE,
          startTime: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify games were updated to FINISHED
      expect(mockPrismaService.game.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['game-1', 'game-2'] },
          status: GameStatus.LIVE,
        },
        data: {
          status: GameStatus.FINISHED,
          updatedAt: expect.any(Date),
        },
      });

      // Verify RabbitMQ events were emitted for each game
      expect(mockRabbitClient.emit).toHaveBeenCalledTimes(2);
      expect(mockRabbitClient.emit).toHaveBeenCalledWith(
        GAME_FINISHED_EVENT,
        expect.objectContaining({
          gameId: 'game-1',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          finishedAt: expect.any(Date),
        }),
      );
      expect(mockRabbitClient.emit).toHaveBeenCalledWith(
        GAME_FINISHED_EVENT,
        expect.objectContaining({
          gameId: 'game-2',
          homeTeam: 'Celtics',
          awayTeam: 'Heat',
          finishedAt: expect.any(Date),
        }),
      );
    });

    it('should do nothing when no LIVE games found', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.handleAutoFinishGames();

      expect(mockPrismaService.game.findMany).toHaveBeenCalled();
      expect(mockPrismaService.game.updateMany).not.toHaveBeenCalled();
      expect(mockRabbitClient.emit).not.toHaveBeenCalled();
    });

    it('should use custom hours threshold from config', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue) => {
        if (key === 'gameFinishSimulator.hoursThreshold') {
          return 6; // Custom 6 hours threshold
        }
        return defaultValue;
      });

      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.handleAutoFinishGames();

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'gameFinishSimulator.hoursThreshold',
        3,
      );
    });

    it('should calculate correct threshold date', async () => {
      const mockDate = new Date('2025-11-03T15:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.handleAutoFinishGames();

      const expectedThreshold = new Date('2025-11-03T12:00:00Z'); // 3 hours before

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: {
          status: GameStatus.LIVE,
          startTime: {
            lt: expectedThreshold,
          },
        },
      });

      jest.restoreAllMocks();
    });

    it('should handle errors gracefully without throwing', async () => {
      mockPrismaService.game.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(service.handleAutoFinishGames()).resolves.not.toThrow();

      expect(mockPrismaService.game.updateMany).not.toHaveBeenCalled();
      expect(mockRabbitClient.emit).not.toHaveBeenCalled();
    });

    it('should handle partial failures in event emission', async () => {
      const mockGames = [
        {
          id: 'game-1',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: new Date(),
          status: GameStatus.LIVE,
        },
      ];

      mockPrismaService.game.findMany.mockResolvedValue(mockGames);
      mockPrismaService.game.updateMany.mockResolvedValue({ count: 1 });
      mockRabbitClient.emit.mockImplementation(() => {
        throw new Error('RabbitMQ error');
      });

      // Should not throw even if event emission fails
      await expect(service.handleAutoFinishGames()).resolves.not.toThrow();
    });

    it('should only update games with LIVE status', async () => {
      const mockGames = [
        {
          id: 'game-1',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: new Date(),
          status: GameStatus.LIVE,
        },
      ];

      mockPrismaService.game.findMany.mockResolvedValue(mockGames);
      mockPrismaService.game.updateMany.mockResolvedValue({ count: 1 });

      await service.handleAutoFinishGames();

      // Verify additional safety check for LIVE status
      expect(mockPrismaService.game.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: GameStatus.LIVE,
        }),
        data: expect.any(Object),
      });
    });
  });
});
