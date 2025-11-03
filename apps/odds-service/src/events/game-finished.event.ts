export class GameFinishedEvent {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  finishedAt: Date;

  constructor(partial: Partial<GameFinishedEvent>) {
    Object.assign(this, partial);
  }
}

export const GAME_FINISHED_EVENT = 'game.finished';
