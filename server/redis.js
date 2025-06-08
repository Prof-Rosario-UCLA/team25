import Redis from 'ioredis';
import dotenv from 'dotenv'; // Import dotenv

// Load environment variables from .env file
// This is important if redis.js is imported before index.js calls dotenv.config()
// or if you run parts of your app that use this module independently.
// If index.js always loads first and calls dotenv.config(), this specific call might be redundant
// but it's safer to include it here for this module's self-sufficiency.
dotenv.config();

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD; // This will be undefined if not set

if (!redisHost || !redisPort) {
  console.error(
    'REDIS_HOST and REDIS_PORT environment variables are not set! ' +
    'Redis client will attempt to connect to default (localhost:6379) or fail if those are also not available.'
  );
  // In a production environment, you might want to throw an error or exit
  // if these are not set, as it indicates a configuration issue.
  // For now, it will fall back to ioredis defaults if not provided.
}

const redisConfig = {
  host: redisHost, // Will be undefined if not set, ioredis defaults to localhost
  port: redisPort ? parseInt(redisPort, 10) : undefined, // Will be undefined if not set, ioredis defaults to 6379
  // Recommended for production to handle transient network issues
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000); // Exponential backoff, max 3s
    console.log(`Redis: retrying connection, attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true; // or `return 1;`
    }
    // For other errors, don't attempt reconnection automatically by ioredis
    return false;
  },
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production', // More detail in dev
  // Enable lazy connect to avoid blocking app startup if Redis is temporarily down
  // However, be mindful that operations will fail until connection is established.
  // For critical Redis use, you might want to ensure connection on startup.
  lazyConnect: true,
};

if (redisPassword) {
  redisConfig.password = redisPassword;
}

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log(`Connected to Redis at ${redis.options.host}:${redis.options.port}`);
});

redis.on('ready', () => {
  console.log('Redis client is ready.');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
  // If lazyConnect is false, an initial connection error here could crash the app
  // if not handled by ioredis's internal retry or your own logic.
});

redis.on('close', () => {
  console.log('Redis connection closed.');
});

redis.on('reconnecting', () => {
  console.log('Redis client is reconnecting...');
});

export default redis;