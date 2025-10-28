import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  Min,
  IsUUID,
} from 'class-validator';

export enum BetTypeEnum {
  MONEYLINE = 'MONEYLINE',
  SPREAD = 'SPREAD',
  OVER_UNDER = 'OVER_UNDER',
}

export enum SelectionEnum {
  HOME = 'home',
  AWAY = 'away',
  DRAW = 'draw',
}

export class PlaceBetDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Game ID' })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({ enum: BetTypeEnum, default: BetTypeEnum.MONEYLINE })
  @IsEnum(BetTypeEnum)
  betType: BetTypeEnum;

  @ApiProperty({
    enum: SelectionEnum,
    description: 'Bet selection: home, away, or draw',
  })
  @IsEnum(SelectionEnum)
  selection: SelectionEnum;

  @ApiProperty({ description: 'Bet amount', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;
}
