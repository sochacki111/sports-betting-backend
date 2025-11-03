# Sports Betting Backend

A microservices-based sports betting platform built with NestJS, featuring real-time odds integration, bet placement, and automated settlement.

## Architecture

This project consists of two microservices:

### 1. **Odds Service** (Port 3001)
- Fetches and manages sports odds from The Odds API
- Provides REST API for game and odds management
- Exposes gRPC server for inter-service communication
- Generates game results for bet settlement

### 2. **Betting Service** (Port 3002)
- Handles bet placement with comprehensive validation
- Manages user accounts and balances
- Communicates with Odds Service via gRPC
- Settles bets based on game results

### Tech Stack
- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Communication**: REST APIs (external) + gRPC (inter-service)
- **Logging**: Pino
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator
- **Testing**: Jest

## Features

### Odds Service
- ✅ Fetch odds from The Odds API (multiple sports)
- ✅ Store games and odds in PostgreSQL
- ✅ REST endpoints for game listing and odds
- ✅ Manual game result generation (random or specified scores)
- ✅ gRPC server for Betting Service integration
- ✅ Swagger documentation at `/api/docs`

### Betting Service
- ✅ Place bets with validation (balance, limits, duplicates)
- ✅ Mock user system (john_doe, jane_smith, bob_jones)
- ✅ Real-time odds validation via gRPC
- ✅ Bet settlement with automatic balance updates
- ✅ Strategy pattern for bet types (Moneyline implemented)
- ✅ User status endpoint (balance, stats, bets)
- ✅ Comprehensive error handling
- ✅ Swagger documentation at `/api/docs`

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- The Odds API key (free tier: https://the-odds-api.com/)

## Installation

1. **Clone and install dependencies**
```bash
cd sports-betting-backend
npm install
```

2. **Setup environment variables**
```bash
cp .env.example .env
```

Edit `.env` and set:
- `THE_ODDS_API_KEY` - Your API key from the-odds-api.com
- Database URLs (default uses localhost with different ports)

3. **Setup PostgreSQL databases**

Create two databases:
```sql
CREATE DATABASE odds_db;
CREATE DATABASE betting_db;
```

Or use Docker:
```bash
# Odds DB
docker run --name odds-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres

# Betting DB
docker run --name betting-postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres
```

4. **Run Prisma migrations**
```bash
npm run prisma:migrate:odds
npm run prisma:migrate:betting
```

5. **Generate Prisma clients**
```bash
npm run prisma:generate
```

**Note:** If you get peer dependency errors during `npm install`, the dependencies have been tested and work correctly. The warnings can be safely ignored.

## Running the Services

### Development Mode

Run both services in separate terminals:

**Terminal 1 - Odds Service:**
```bash
npm run start:odds:dev
```

**Terminal 2 - Betting Service:**
```bash
npm run start:betting:dev
```

### Production Mode

```bash
# Build
npm run build:odds
npm run build:betting

# Run
npm run start:odds:prod
npm run start:betting:prod
```

## API Documentation

Once running, access Swagger documentation:
- **Odds Service**: http://localhost:3001/api/docs
- **Betting Service**: http://localhost:3002/api/docs

## Usage Flow

### 1. Setup Initial Data

```bash
# Refresh odds from The Odds API
curl -X POST http://localhost:3001/odds/refresh

# Create mock users
curl -X POST http://localhost:3002/users/mock/create
```

### 2. Get Available Games

```bash
# List all upcoming games
curl http://localhost:3001/games?status=UPCOMING
```

### 3. Get User ID

```bash
# Get user details by username
curl http://localhost:3002/users/username/john_doe
# Copy the 'id' field for placing bets
```

### 4. Place a Bet

```bash
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "gameId": "GAME_ID_FROM_STEP_2",
    "betType": "MONEYLINE",
    "selection": "home",
    "amount": 100
  }'
```

### 5. Check User Status

```bash
curl http://localhost:3002/users/YOUR_USER_ID/status
```

### 6. Generate Game Result

```bash
# Random result
curl -X POST http://localhost:3001/games/GAME_ID/result \
  -H "Content-Type: application/json" \
  -d '{}'

# Specific result
curl -X POST http://localhost:3001/games/GAME_ID/result \
  -H "Content-Type: application/json" \
  -d '{
    "homeScore": 3,
    "awayScore": 1
  }'
```

### 7. Settle Bets

```bash
curl -X POST http://localhost:3002/bets/settle/GAME_ID
```

### 8. Check Updated User Status

```bash
curl http://localhost:3002/users/YOUR_USER_ID/status
```

## Postman Collection

Import the Postman collection from `postman/Sports-Betting-API.postman_collection.json` for pre-configured API examples.

### Variables to Set
- `userId` - Get from "Get User by Username" endpoint
- `gameId` - Get from "Get All Games" endpoint

## Configuration

Edit `.env` file:

```env
# Odds Service
ODDS_SERVICE_PORT=3001
ODDS_SERVICE_GRPC_PORT=5001
ODDS_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/odds_db?schema=public"
THE_ODDS_API_KEY=your_api_key_here

# Betting Service
BETTING_SERVICE_PORT=3002
BETTING_GRPC_URL=localhost:5001
BETTING_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/betting_db?schema=public"

# Betting Configuration
DEFAULT_USER_BALANCE=1000
MIN_BET_AMOUNT=1
MAX_BET_AMOUNT=500
```

## Bet Validation Rules

The system prevents common betting errors:

1. **Balance Check**: User must have sufficient funds
2. **Amount Limits**: Bets must be between MIN and MAX amounts
3. **Duplicate Prevention**: Same user cannot place multiple bets with same selection on same game
4. **Game Validation**:
   - Game must exist
   - Game must be UPCOMING
   - Game must not have started yet
5. **Odds Validation**: Odds are fetched in real-time from Odds Service

## Testing

### Test Commands

```bash
# Run all unit tests
npm test

# Run all tests (unit + E2E)
npm run test:all

# Run specific service tests
npm run test:odds           # Odds service only (25 tests)
npm run test:betting        # Betting service only (36 tests)

# Run E2E tests
npm run test:e2e            # Odds service E2E (3 tests)
npm run test:e2e:odds       # Alias for above

# Development
npm run test:watch          # Watch mode (re-run on changes)
npm run test:cov            # Coverage report
npm run test:debug          # Debug mode
```

### Test Coverage

**Total: 64 tests (61 unit + 3 E2E)**

**Odds Service (25 unit tests):**
- ✅ [GamesService](apps/odds-service/src/games/games.service.spec.ts) - 11 tests
  - refreshOdds(), validateGame(), generateResult()
  - findAll(), findOne(), findByIds()
- ✅ [GameFinishSimulatorService](apps/odds-service/src/games/game-finish-simulator.service.spec.ts) - 7 tests
  - Cron job, event emission, error handling
- ✅ [GamesController E2E](apps/odds-service/test/games.e2e-spec.ts) - 3 tests

**Betting Service (36 unit tests):**
- ✅ [BetsService](apps/betting-service/src/bets/bets.service.spec.ts) - 15 tests
  - placeBet() - validation, balance checks, duplicates
  - settleBets() - WON/LOST/PUSH, balance updates
- ✅ [UsersService](apps/betting-service/src/users/users.service.spec.ts) - 16 tests
  - createMockUsers(), findById(), getUserStatus(), updateBalance()
- ✅ [MoneylineStrategy](apps/betting-service/src/bets/strategies/moneyline.strategy.spec.ts) - 5 tests
  - calculatePotentialWin(), settleBet()

### Running Specific Tests

```bash
# Run a specific test file
npm test apps/betting-service/src/bets/bets.service.spec.ts

# Run tests matching a pattern
npm test -- -t "settleBets"

# Run with verbose output
npm test -- --verbose
```

## Database Management

### Prisma Studio (Database GUI)

```bash
# Odds DB
npm run prisma:studio:odds

# Betting DB
npm run prisma:studio:betting
```

### Create New Migration

```bash
# After modifying schema.prisma files
npm run prisma:migrate:odds
npm run prisma:migrate:betting
```

## Project Structure

```
sports-betting-backend/
├── apps/
│   ├── odds-service/           # Odds microservice
│   │   ├── src/
│   │   │   ├── games/          # Games module (REST)
│   │   │   ├── odds/           # Odds module (REST)
│   │   │   ├── grpc/           # gRPC server
│   │   │   ├── prisma/         # Prisma service
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Odds DB schema
│   │   └── test/
│   │
│   └── betting-service/        # Betting microservice
│       ├── src/
│       │   ├── bets/           # Bets module
│       │   │   └── strategies/ # Bet type strategies
│       │   ├── users/          # Users module
│       │   ├── odds-client/    # gRPC client
│       │   ├── prisma/         # Prisma service
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── prisma/
│       │   └── schema.prisma   # Betting DB schema
│       └── test/
│
├── proto/
│   └── odds.proto              # gRPC definitions
├── postman/
│   └── Sports-Betting-API.postman_collection.json
├── .env                        # Environment config
├── package.json
└── README.md
```

## Bet Types (Strategy Pattern)

Currently implemented:
- **MONEYLINE**: Simple winner selection (home/away/draw)

Easy to extend with new strategies:
```typescript
// Future implementations
- SPREAD: Team wins by X points
- OVER_UNDER: Total score over/under threshold
```

## Logging

Pino logger is configured for both services:
- **Development**: Pretty-printed colored logs
- **Production**: JSON logs for log aggregation

Log levels: `debug` (dev) | `info` (prod)

## Error Handling

Common error responses:

| Status | Error | Reason |
|--------|-------|--------|
| 400 | Bad Request | Invalid input, insufficient funds, bet limits |
| 404 | Not Found | User/Game not found |
| 409 | Conflict | Duplicate bet |
| 500 | Internal Server Error | Unexpected error |

## Troubleshooting

### gRPC Connection Issues
```bash
# Ensure Odds Service gRPC is running
curl http://localhost:3001/games
# Should return 200 OK

# Check BETTING_GRPC_URL in .env matches ODDS_SERVICE_GRPC_PORT
```

### Database Connection Issues
```bash
# Test PostgreSQL connections
psql -h localhost -p 5432 -U postgres -d odds_db
psql -h localhost -p 5433 -U postgres -d betting_db

# Regenerate Prisma clients
npm run prisma:generate
```


## Future Enhancements

- [ ] **Feature toggles for simulation handlers** - Currently all simulation handlers (game finish simulator, score generation, bet settlement) are always active. Consider adding toggles via runtime feature flags.

- [ ] User authentication (JWT)
- [ ] WebSocket for real-time odds updates
- [ ] Additional bet types (Spread, Over/Under)
- [ ] Bet history analytics
- [ ] Admin dashboard
- [ ] Rate limiting
- [ ] Caching layer (Redis)
- [ ] Docker Compose setup
- [ ] CI/CD pipeline

## License

UNLICENSED

## Support

For issues or questions:
1. Check Swagger documentation
2. Review Postman collection
3. Check application logs
4. Verify database connections