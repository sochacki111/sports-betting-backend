import { ApiProperty } from '@nestjs/swagger';

export class BetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  gameId: string;

  @ApiProperty()
  betType: string;

  @ApiProperty()
  selection: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  odds: number;

  @ApiProperty()
  potentialWin: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  result: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
