# Database Setup Guide

Choose one of the following options based on your setup:

## Option 1: Using Existing Local PostgreSQL (Recommended if you already have PostgreSQL)

If port 5432 is already in use, you likely have PostgreSQL installed locally.

### Step 1: Connect to PostgreSQL as superuser

```bash
# Try connecting as postgres user
sudo -u postgres psql

# OR if that doesn't work, try:
psql -U postgres

# OR connect as your current user if it has superuser privileges
psql postgres
```

### Step 2: Create databases and user (run inside psql)

```sql
-- Create user for the app
CREATE USER sports_betting WITH PASSWORD 'postgres';

-- Create databases
CREATE DATABASE odds_db OWNER sports_betting;
CREATE DATABASE betting_db OWNER sports_betting;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE odds_db TO sports_betting;
GRANT ALL PRIVILEGES ON DATABASE betting_db TO sports_betting;

-- Exit psql
\q
```

### Step 3: Update .env file

```bash
# Edit your .env file
nano .env

# Change the connection strings to use the new user:
ODDS_DATABASE_URL="postgresql://sports_betting:postgres@localhost:5432/odds_db?schema=public"
BETTING_DATABASE_URL="postgresql://sports_betting:postgres@localhost:5432/betting_db?schema=public"
```

### Step 4: Test connection

```bash
psql -U sports_betting -d odds_db -h localhost
# Password: postgres
# If it works, you'll see the psql prompt
\q
```

---

## Option 2: Using Docker (Recommended for clean setup)

If you don't have PostgreSQL installed or want isolated databases:

### Step 1: Stop any existing PostgreSQL service

```bash
# Stop local PostgreSQL if running
sudo systemctl stop postgresql
# OR
sudo service postgresql stop
```

### Step 2: Start Docker containers

```bash
# Create odds database container
docker run --name odds-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=odds_db \
  -p 5432:5432 \
  -d postgres

# Create betting database container
docker run --name betting-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=betting_db \
  -p 5433:5432 \
  -d postgres

# Wait for containers to start
sleep 5

# Verify they're running
docker ps | grep postgres
```

### Step 3: Update .env file

```bash
# Use default .env values (already correct):
ODDS_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/odds_db?schema=public"
BETTING_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/betting_db?schema=public"
```

---

## Option 3: Use Different Ports (If port 5432 is busy)

```bash
# Use different ports for Docker containers
docker run --name odds-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=odds_db \
  -p 5434:5432 \
  -d postgres

docker run --name betting-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=betting_db \
  -p 5435:5432 \
  -d postgres

# Update .env accordingly:
ODDS_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/odds_db?schema=public"
BETTING_DATABASE_URL="postgresql://postgres:postgres@localhost:5435/betting_db?schema=public"
```

---

## Verify Setup

After choosing one of the options above:

```bash
# Test connection to odds_db
psql -U sports_betting -h localhost -p 5432 odds_db
# OR if using docker with default settings:
psql -U postgres -h localhost -p 5432 odds_db

# List databases
\l

# Exit
\q
```

---

## Continue with Migrations

Once databases are set up, continue with:

```bash
# Run Prisma migrations
npm run prisma:migrate:odds
npm run prisma:migrate:betting

# Generate Prisma clients
npm run prisma:generate
```

---

## Troubleshooting

### "Port already in use"
- Check what's using the port: `lsof -i :5432` (may need sudo)
- Use Option 1 (local PostgreSQL) or Option 3 (different ports)

### "Role does not exist"
- You need to create the user first (see Option 1, Step 2)
- OR use docker with default postgres user (Option 2)

### "Connection refused"
- PostgreSQL may not be running: `sudo systemctl status postgresql`
- Docker container may not be running: `docker ps`
- Check firewall settings

### "Password authentication failed"
- Verify .env has correct credentials
- For local PostgreSQL, check pg_hba.conf authentication method

### Need to clean up Docker containers?
```bash
docker stop odds-postgres betting-postgres
docker rm odds-postgres betting-postgres
```

---

## Which option should I choose?

- **You already have PostgreSQL**: Use **Option 1**
- **Clean slate, prefer Docker**: Use **Option 2**
- **Port 5432 busy, can't stop it**: Use **Option 3**

For this project, I recommend **Option 1** since you seem to have PostgreSQL already installed!
