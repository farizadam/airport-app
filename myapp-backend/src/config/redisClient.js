const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(redisUrl, {
  connectTimeout: 5000, // Stop trying to connect after 5 seconds
  maxRetriesPerRequest: 1, // Fail fast instead of hanging the API
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err) => {
  console.error("Redis error: Could not connect. Check if Redis is running.");
});

module.exports = redis;
