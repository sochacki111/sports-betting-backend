import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BetsService } from './bets.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { BetResponseDto } from './dto/bet-response.dto';

@ApiTags('bets')
@Controller('bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a new bet' })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    type: BetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request (validation errors)' })
  @ApiResponse({ status: 409, description: 'Duplicate bet' })
  async placeBet(@Body() placeBetDto: PlaceBetDto) {
    return this.betsService.placeBet(placeBetDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all bets for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'List of user bets',
    type: [BetResponseDto],
  })
  async getUserBets(@Param('userId') userId: string) {
    return this.betsService.findAllBetsByUser(userId);
  }

  @Post('settle/:gameId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Settle all bets for a finished game' })
  @ApiParam({ name: 'gameId', description: 'Game ID' })
  @ApiResponse({
    status: 200,
    description: 'Bets settled successfully',
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 400, description: 'Game not finished' })
  async settleBets(@Param('gameId') gameId: string) {
    return this.betsService.settleBets(gameId);
  }
}
