-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'UPCOMING',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "home_odds" DOUBLE PRECISION,
    "away_odds" DOUBLE PRECISION,
    "draw_odds" DOUBLE PRECISION,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_external_id_key" ON "games"("external_id");

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE INDEX "games_start_time_idx" ON "games"("start_time");

-- CreateIndex
CREATE INDEX "odds_game_id_idx" ON "odds"("game_id");

-- CreateIndex
CREATE INDEX "odds_bookmaker_idx" ON "odds"("bookmaker");

-- AddForeignKey
ALTER TABLE "odds" ADD CONSTRAINT "odds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
