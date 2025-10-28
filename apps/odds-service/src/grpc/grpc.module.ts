import { Module } from '@nestjs/common';
import { GrpcController } from './grpc.controller';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [GamesModule],
  controllers: [GrpcController],
})
export class GrpcModule {}
