# Quick Start Guide

This guide will walk you through setting up and using the Sports Betting Backend in 5 minutes.

## Prerequisites

- Node.js 18+
- PostgreSQL running on ports 5432 and 5433
- The Odds API key

## 1. Setup (First Time Only)

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and add your THE_ODDS_API_KEY

# Create databases
# ⚠️ See SETUP_DATABASE.md for detailed instructions
# Quick options:

# Option A: If you have PostgreSQL installed locally
# Follow SETUP_DATABASE.md Option 1 (create user + databases)

# Option B: Using Docker (if PostgreSQL not installed)
docker run --name odds-postgres -e POSTGRES_DB=odds_db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
docker run --name betting-postgres -e POSTGRES_DB=betting_db -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres

# Run migrations
npm run prisma:migrate:odds
npm run prisma:migrate:betting

# Generate Prisma clients
npm run prisma:generate
```

## 2. Start Services

Open two terminal windows:

**Terminal 1:**
```bash
npm run start:odds:dev
```

**Terminal 2:**
```bash
npm run start:betting:dev
```

Wait for both services to start (you'll see "running on" messages).

## 3. Complete Betting Flow

### Step 1: Refresh Odds
```bash
curl -X POST http://localhost:3001/odds/refresh
```

### Step 2: Get Available Games
```bash
curl http://localhost:3001/games?status=UPCOMING | jq
```

Copy a `gameId` from the response.

### Step 3: Create Mock Users
```bash
curl -X POST http://localhost:3002/users/mock/create
```

### Step 4: Get User ID
```bash
curl http://localhost:3002/users/username/john_doe | jq
```

Copy the `id` field.

### Step 5: Place a Bet
```bash
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "PASTE_USER_ID_HERE",
    "gameId": "PASTE_GAME_ID_HERE",
    "betType": "MONEYLINE",
    "selection": "home",
    "amount": 100
  }' | jq
```

### Step 6: Check User Status
```bash
curl http://localhost:3002/users/PASTE_USER_ID_HERE/status | jq
```

You should see:
- Balance decreased by 100
- 1 pending bet

### Step 7: Generate Game Result
```bash
curl -X POST http://localhost:3001/games/PASTE_GAME_ID_HERE/result \
  -H "Content-Type: application/json" \
  -d '{"homeScore": 3, "awayScore": 1}' | jq
```

### Step 8: Settle Bets
```bash
curl -X POST http://localhost:3002/bets/settle/PASTE_GAME_ID_HERE | jq
```

### Step 9: Check Final User Status
```bash
curl http://localhost:3002/users/PASTE_USER_ID_HERE/status | jq
```

You should see:
- Updated balance (increased if bet won)
- Bet status changed to "SETTLED"
- Bet result is "WON", "LOST", or "PUSH"

## Swagger UI (Alternative)

You can also use the Swagger UI:

- **Odds Service**: http://localhost:3001/api/docs
- **Betting Service**: http://localhost:3002/api/docs

## Test Different Scenarios

### Insufficient Funds
```bash
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "PASTE_USER_ID",
    "gameId": "PASTE_GAME_ID",
    "betType": "MONEYLINE",
    "selection": "home",
    "amount": 10000
  }'
# Expected: 400 Bad Request - Insufficient balance
```

### Duplicate Bet
```bash
# Place the same bet twice (same user, game, selection)
# Expected: 409 Conflict on second attempt
```

### Below Minimum Bet
```bash
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "PASTE_USER_ID",
    "gameId": "PASTE_GAME_ID",
    "betType": "MONEYLINE",
    "selection": "home",
    "amount": 0.5
  }'
# Expected: 400 Bad Request - Below minimum
```

## Database Inspection

```bash
# View Odds DB
npm run prisma:studio:odds

# View Betting DB
npm run prisma:studio:betting
```

## Troubleshooting

### "No games found"
- Check your API key is valid
- The Odds API free tier has limits
- Some sports may not have active games

### "Connection refused" on gRPC
- Ensure Odds Service started first
- Check ports 3001 and 5001 are free
- Verify `.env` has correct `BETTING_GRPC_URL=localhost:5001`

### Database connection errors
- Ensure PostgreSQL is running
- Check port 5432 and 5433 are accessible
- Run migrations: `npm run prisma:migrate:odds && npm run prisma:migrate:betting`

## Next Steps

1. Import [Postman collection](postman/Sports-Betting-API.postman_collection.json)
2. Read full [README.md](README.md) for detailed documentation
3. Explore Swagger docs at `/api/docs`
4. Run tests: `npm test`
5. Check logs for debugging

---

Happy betting!
