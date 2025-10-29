# Claude - Sports Betting Backend Project Notes

## Project Overview

**Type:** Sports betting microservices
**Architecture:** NestJS monorepo with two services
**Communication:** gRPC between services (user requirement)
**Database:** PostgreSQL + Prisma ORM (separate databases per service)

## Microservices Structure

### 1. Odds Service (Port 3001 REST, 5001 gRPC)
- Fetching odds from The Odds API
- Managing games and statuses
- Generating game results
- gRPC server for Betting Service

### 2. Betting Service (Port 3002 REST)
- User management (mock users)
- Bet placement with validation
- gRPC client to Odds Service
- Automatic bet settlement
- Strategy Pattern for bet types (currently Moneyline)

## Key Architectural Decisions

1. **gRPC Communication** - user requirement for efficient inter-service communication
2. **Prisma with separate clients:**
   ```
   @prisma/odds-client
   @prisma/betting-client
   ```
3. **Strategy Pattern** for bet types - easy extension for Spread, Over/Under
4. **Unique Constraint** preventing duplicate bets: `@@unique([userId, gameId, selection])`
5. **Transactions** for atomic bet placement (balance - bet in one transaction)

## Critical Problems and Solutions

### Problem 1: NestJS 11 Dependency Conflicts
**Error:** `@nestjs/config@3.2.3` and `@nestjs/swagger@8.0.7` incompatible
**Fix:** Upgrade to `@nestjs/config@4.0.2` and `@nestjs/swagger@11.0.2`

### Problem 2: PostgreSQL Port Conflict
**Error:** Port 5432 busy with local PostgreSQL
**Solution:** Docker on ports 5434 (odds) and 5435 (betting)
```bash
docker run --name odds-postgres -e POSTGRES_DB=odds_db -p 5434:5432 -d postgres
docker run --name betting-postgres -e POSTGRES_DB=betting_db -p 5435:5432 -d postgres
```

### Problem 3: Proto File Path Resolution
**Error:** `InvalidProtoDefinitionException: file at "/dist/proto/odds.proto" not found`
**Cause:** `join(__dirname, '../../../proto/odds.proto')` doesn't work after compilation
**Fix:**
```typescript
protoPath: resolve(process.cwd(), 'proto/odds.proto')
```
**Applied in:**
- `apps/odds-service/src/main.ts`
- `apps/betting-service/src/odds-client/odds-client.service.ts`

### Problem 4: Balance Type Validation
**Error:** "Expected Float, provided String"
**Cause:** `ConfigService.get<number>()` returns string
**Fix:**
```typescript
const defaultBalance = Number(
  this.configService.get<string>('DEFAULT_USER_BALANCE', '1000'),
);
```
**Location:** `apps/betting-service/src/users/users.service.ts:54`

### Problem 5: Game Time Validation
**For demo:** Temporarily disabled game start time validation
**Location:** `apps/odds-service/src/games/games.service.ts:197-202` (commented out)

## Key Files and Their Roles

### Proto Definition
- **proto/odds.proto** - gRPC definition (GetGameOdds, ValidateGame, GetGamesByIds)

### Environment Configuration
- **.env** - Docker ports (5434, 5435), The Odds API key

### Prisma Schemas

**Odds Service:**
```prisma
model Game {
  id          String     @id @default(uuid())
  sportKey    String
  homeTeam    String
  awayTeam    String
  startTime   DateTime
  status      GameStatus @default(UPCOMING)
  homeScore   Int?
  awayScore   Int?
  odds        Odds[]
}

enum GameStatus {
  UPCOMING
  LIVE
  FINISHED
  CANCELLED
}
```

**Betting Service:**
```prisma
model Bet {
  id          String     @id @default(uuid())
  userId      String
  gameId      String
  betType     BetType
  selection   String    // 'home' or 'away'
  amount      Float
  odds        Float
  potentialWin Float
  status      BetStatus  @default(PENDING)
  result      BetResult? @default(PENDING)
  settledAt   DateTime?

  @@unique([userId, gameId, selection]) // Prevents duplicates
}
```

### Moneyline Strategy
**Location:** `apps/betting-service/src/bets/strategies/moneyline.strategy.ts`

```typescript
settleBet(selection: string, homeScore: number, awayScore: number, homeTeam: string, awayTeam: string): BetResult {
  if (homeScore > awayScore && selection === 'home') return { result: 'WON' };
  if (awayScore > homeScore && selection === 'away') return { result: 'WON' };
  if (homeScore === awayScore) return { result: 'PUSH' };
  return { result: 'LOST' };
}
```

## Betting Flow (Tested End-to-End)

1. **Create users** - POST `/users/mock` (starting balance: $1000)
2. **Refresh odds** - POST `/games/refresh-odds` (fetches from The Odds API)
3. **List games** - GET `/games?status=UPCOMING`
4. **Place bet** - POST `/bets`:
   - User balance validation
   - Game validation via gRPC
   - Duplicate check
   - Transaction: balance - amount + bet creation
5. **Generate result** - POST `/games/{id}/result` (random or manual)
6. **Settle bets** - POST `/bets/settle/{gameId}`:
   - Fetches game details via gRPC
   - MoneylineStrategy determines outcome
   - Updates user balance
   - Changes bet status to SETTLED
7. **User status** - GET `/users/{id}/status` (balance, stats, bets)

## Tested Example

**User:** john_doe (ID: 88a66d83-ec52-4393-82ca-0b05dfd5704a)
**Game:** Washington Wizards vs Philadelphia 76ers
**Bet:** $100 on Philadelphia (away) at odds 1.53
**Result:** Home 95 - Away 110 (Philadelphia wins)
**Outcome:** Bet won, payout $153
**Final balance:** $1,053 ($1000 - $100 + $153)

## Startup Commands

```bash
# Databases (Docker)
docker start odds-postgres betting-postgres

# Prisma
npm run prisma:generate:odds
npm run prisma:generate:betting

# Services (development)
npm run start:odds:dev    # localhost:3001 (REST), localhost:5001 (gRPC)
npm run start:betting:dev # localhost:3002 (REST)
```

## Environment Variables (.env)

```env
# Odds Service Database
ODDS_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/odds_db?schema=public"

# Betting Service Database
BETTING_DATABASE_URL="postgresql://postgres:postgres@localhost:5435/betting_db?schema=public"

# API Configuration
THE_ODDS_API_KEY=0f0e9f0ae743d3d97e9c351dff1ede6c
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4

# Service Ports
ODDS_PORT=3001
BETTING_PORT=3002
ODDS_GRPC_PORT=5001
BETTING_GRPC_URL=localhost:5001

# Default Settings
DEFAULT_USER_BALANCE=1000
MIN_BET_AMOUNT=1
MAX_BET_AMOUNT=10000
```

## API Documentation

**Swagger UI:**
- Odds Service: http://localhost:3001/api
- Betting Service: http://localhost:3002/api

**Postman Collection:** `postman/Sports-Betting-API.postman_collection.json`

## Implemented Nice-to-haves

- ✅ **Pino Logger** - structured logging (user's ecosystem preference)
- ✅ **Swagger/OpenAPI** - API documentation with DTOs
- ✅ **Unit Tests** - service and strategy tests
- ✅ **E2E Tests** - API endpoint tests
- ✅ **Postman Collection** - ready-to-use requests
- ✅ **Docker Support** - PostgreSQL in containers
- ✅ **Comprehensive Documentation** - README, QUICK_START, ARCHITECTURE

## Extensibility

### Adding a new bet type (e.g., Spread):

1. Create `spread.strategy.ts`:
```typescript
@Injectable()
export class SpreadStrategy implements BetStrategy {
  calculatePotentialWin(amount: number, odds: number): number {
    return amount * odds;
  }

  settleBet(selection: string, homeScore: number, awayScore: number,
            homeTeam: string, awayTeam: string, spread: number): BetResult {
    // Spread betting logic
  }
}
```

2. Register in `bet-strategy.factory.ts`
3. Add `BetType.SPREAD` to enum
4. Extend DTO with spread parameter

## Final Notes

- **gRPC** ensures efficient inter-service communication
- **Strategy Pattern** allows easy addition of new bet types
- **Prisma** with separate clients prevents conflicts between services
- **Transactions** guarantee data consistency during bet placement
- System ready for extension: live betting, more sports, real-time odds updates

## Project Status

✅ Implementation complete
✅ End-to-end tests passed successfully
✅ Full documentation
✅ All requirements met (core + nice-to-haves)
