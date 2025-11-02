export default () => ({
  port: parseInt(process.env.ODDS_SERVICE_PORT || '3001', 10),
  grpcPort: parseInt(process.env.ODDS_SERVICE_GRPC_PORT || '5001', 10),
  database: {
    url: process.env.ODDS_DATABASE_URL,
  },
  oddsApi: {
    key: process.env.THE_ODDS_API_KEY,
    baseUrl: process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4',
    supportedSports: process.env.SUPPORTED_SPORTS
      ? process.env.SUPPORTED_SPORTS.split(',').map((sport) => sport.trim())
      : ['basketball_nba', 'soccer_epl', 'americanfootball_nfl'],
  },
  gameFinishSimulator: {
    enabled: process.env.ENABLE_GAME_FINISH_SIMULATOR === 'true',
    cronExpression: process.env.GAME_FINISH_CRON || '0 */5 * * * *',
    hoursThreshold: parseInt(process.env.GAME_FINISH_HOURS_THRESHOLD || '3', 10),
  },
});
