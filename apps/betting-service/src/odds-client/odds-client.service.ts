import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc, Client, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';

interface OddsService {
  getGameOdds(data: { gameId: string }): Promise<any>;
  validateGame(data: { gameId: string }): Promise<any>;
  getGamesByIds(data: { gameIds: string[] }): Promise<any>;
}

@Injectable()
export class OddsClientService implements OnModuleInit {
  private readonly logger = new Logger(OddsClientService.name);
  private oddsService: OddsService;

  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'odds',
      protoPath: join(__dirname, '../../../proto/odds.proto'),
      url: process.env.BETTING_GRPC_URL || 'localhost:5001',
    },
  })
  private client!: ClientGrpc;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.oddsService = this.client.getService<OddsService>('OddsService');
    this.logger.log('✅ gRPC client connected to Odds Service');
  }

  async getGameOdds(gameId: string) {
    try {
      const result = await firstValueFrom(
        this.oddsService.getGameOdds({ gameId }) as any,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to get game odds for ${gameId}`, error);
      throw error;
    }
  }

  async validateGame(gameId: string) {
    try {
      const result = await firstValueFrom(
        this.oddsService.validateGame({ gameId }) as any,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to validate game ${gameId}`, error);
      throw error;
    }
  }

  async getGamesByIds(gameIds: string[]) {
    try {
      const result = await firstValueFrom(
        this.oddsService.getGamesByIds({ gameIds }) as any,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to get games by IDs', error);
      throw error;
    }
  }
}
