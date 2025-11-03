# Sports Betting Backend

A microservices-based sports betting platform built with NestJS, featuring odds integration, bet placement, and automated settlement.

## Key Highlights

- 🏗️ **Microservices Architecture** - Two independent services communicating via gRPC
- 🐰 **Event-Driven with RabbitMQ** - Asynchronous bet settlement via message queues
- 📊 **Real-time Odds Integration** - Live data from The Odds API
- ⚡ **Strategy Pattern** - Extensible bet type system (Moneyline, ready for Spread/Totals)

## Architecture

This project consists of two microservices:

### 1. **Odds Service** (Port 3001)
- Fetches and manages sports odds from The Odds API
- Provides REST API for game and odds management
- Exposes gRPC server for inter-service communication
- Generates game results for bet settlement
- Publishes game finish events to RabbitMQ for async bet settlement

### 2. **Betting Service** (Port 3002)
- Handles bet placement with comprehensive validation
- Manages user accounts and balances
- Communicates with Odds Service via gRPC
- Listens to RabbitMQ for game finish events
- Automatically settles bets when games finish (or via manual endpoint for testing)

## Features

### Odds Service
- ✅ Fetch odds from The Odds API (multiple sports)
- ✅ Store games and odds in PostgreSQL
- ✅ REST endpoints for game listing and odds
- ✅ Automated cron job to finish games and publish events
- ✅ Manual game result generation (random or specified scores)
- ✅ gRPC server for Betting Service integration
- ✅ RabbitMQ event publishing for game completions
- ✅ Swagger documentation at `/api/docs`

### Betting Service
- ✅ Place bets with validation (balance, limits, duplicates)
- ✅ Mock user system (john_doe, jane_smith, bob_jones)
- ✅ Real-time odds validation via gRPC
- ✅ Event-driven bet settlement via RabbitMQ listeners
- ✅ Manual bet settlement endpoint (for testing)
- ✅ Strategy pattern for bet types (Moneyline implemented)
- ✅ User status endpoint (balance, stats, bets)
- ✅ Comprehensive error handling
- ✅ Swagger documentation at `/api/docs`

## Prerequisites

- Node.js 18+ and npm
- Docker
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

3. **Setup necessary docker containers (PostgreSQL databases, RabbitMQ)**
```bash
docker compose up -d odds-postgres betting-postgres rabbitmq
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

## API Documentation

Once running, access Swagger documentation:
- **Odds Service**: http://localhost:3001/api/docs
- **Betting Service**: http://localhost:3002/api/docs

## Quick Testing Flow

Here's the complete end-to-end flow to test the application:

**Testing Steps:**

1. **Create Mock Users** → `POST /users/mock/create`
   - Creates 3 test users (john_doe, jane_smith, bob_jones)
   - Each starts with $1,000 balance

2. **Refresh Odds** → `POST /odds/refresh`
   - Fetches live games from The Odds API
   - Stores games and odds in database

3. **List Available Games** → `GET /games?status=UPCOMING`
   - View all upcoming games with odds
   - Copy a `gameId` for betting

4. **Place a Bet** → `POST /bets`
   - Bet on home/away team
   - Amount deducted from balance
   - Bet status: PENDING

5. **Check User Status** → `GET /users/{userId}/status`
   - View current balance (should be $900 after $100 bet)
   - See all bets and statistics

6. **Generate Game Result** → `POST /games/{gameId}/result`
   - Simulate game finish (random or specific scores)
   - Game status changes to FINISHED
   - Publishes event to RabbitMQ

7. **Automatic Bet Settlement** (via RabbitMQ)
   - Betting Service listens to game finish events
   - Automatically settles bets and updates balances
   - Alternatively: Manual settlement via `POST /bets/settle/{gameId}` for testing

8. **Check Final Balance** → `GET /users/{userId}/status`
   - If bet won: Balance = $900 + winnings
   - If bet lost: Balance stays $900
   - If push (tie): Balance returns to $1,000

**Quick Test (cURL):**
```bash
curl -X POST http://localhost:3002/users/mock/create
curl -X POST http://localhost:3001/odds/refresh
curl http://localhost:3001/games?status=UPCOMING
# Use Postman collection for easier testing with all endpoints
```

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

After creating mock users, the response will include user IDs. Alternatively, check the Swagger UI at `http://localhost:3002/api/docs` or use the "Create Mock Users" Postman request to see the user IDs in the response.

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
ODDS_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/odds_db?schema=public"
THE_ODDS_API_KEY=your_api_key_here

# Betting Service
BETTING_SERVICE_PORT=3002
BETTING_GRPC_URL=localhost:5001
BETTING_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/betting_db?schema=public"

# Betting Configuration
DEFAULT_USER_BALANCE=1000
MIN_BET_AMOUNT=1
MAX_BET_AMOUNT=500
```


## Testing
```bash
# Run all unit tests
npm test

# Run all tests (unit + E2E)
npm run test:all

# Run specific service tests
npm run test:odds
npm run test:betting

# Run E2E tests
npm run test:e2e:odds
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
npm run prisma:migrate:odds
npm run prisma:migrate:betting
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


## Future Enhancements

- [ ] **Feature toggles for simulation handlers** - Currently all simulation handlers (game finish simulator, score generation, bet settlement) are always active. Consider adding toggles via feature flags.

- [ ] User authentication (JWT)
- [ ] WebSocket for real-time odds updates
- [ ] Additional bet types (Spread, Over/Under)
- [ ] Bet history analytics
- [ ] Admin dashboard
- [ ] Rate limiting
- [ ] Caching layer (Redis)
- [ ] Docker Compose setup
- [ ] CI/CD pipeline


### Tech Stack
- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Communication**: REST APIs (external) + gRPC (inter-service) + RabbitMQ
- **Logging**: Pino
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator
- **Testing**: Jest