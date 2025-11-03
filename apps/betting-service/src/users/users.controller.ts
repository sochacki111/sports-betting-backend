import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('mock/create')
  @ApiOperation({ summary: 'Create mock users for testing' })
  @ApiResponse({ status: 201, description: 'Mock users created' })
  async createMockUsers() {
    await this.usersService.createMockUsers();
    return { message: 'Mock users created successfully' };
  }

  @Get(':userId/status')
  @ApiOperation({ summary: 'Get user status with bets and balance' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStatus(@Param('userId') userId: string) {
    return this.usersService.getUserStatus(userId);
  }
}
