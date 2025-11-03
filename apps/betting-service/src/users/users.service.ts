import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createMockUsers() {
    const defaultBalance = Number(
      this.configService.get<string>('DEFAULT_USER_BALANCE', '1000'),
    );

    const mockUsers = [
      { username: 'john_doe', balance: defaultBalance },
      { username: 'jane_smith', balance: defaultBalance },
      { username: 'bob_jones', balance: defaultBalance },
    ];

    for (const userData of mockUsers) {
      await this.prisma.user.upsert({
        where: { username: userData.username },
        update: {},
        create: userData,
      });
    }

    this.logger.log('✅ Mock users created/verified');
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async getUserStatus(userId: string) {
    const user = await this.findById(userId);

    const bets = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalBets: bets.length,
      pendingBets: bets.filter((b) => b.status === 'PENDING').length,
      wonBets: bets.filter((b) => b.result === 'WON').length,
      lostBets: bets.filter((b) => b.result === 'LOST').length,
      totalWagered: bets.reduce((sum, b) => sum + b.amount, 0),
      totalWon: bets
        .filter((b) => b.result === 'WON')
        .reduce((sum, b) => sum + b.potentialWin, 0),
    };

    return {
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
      },
      stats,
      bets,
    };
  }

  async updateBalance(userId: string, amount: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  }
}
