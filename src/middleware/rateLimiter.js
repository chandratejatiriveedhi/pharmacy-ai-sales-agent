const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('../utils/logger');

// Create rate limiter instances
const rateLimiter = new RateLimiterMemory({
  keyGenerate: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // Per 15 minutes (900 seconds)
});

const strictRateLimiter = new RateLimiterMemory({
  keyGenerate: (req) => req.ip,
  points: 10, // Number of requests
  duration: 60, // Per 1 minute
});

// Middleware function
const rateLimiterMiddleware = async (req, res, next) => {
  try {
    // Use strict rate limiting for sensitive endpoints
    const limiter = req.path.includes('/ai-agent/') ? strictRateLimiter : rateLimiter;
    
    await limiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

module.exports = {
  rateLimiter: rateLimiterMiddleware,
  strictRateLimiter: strictRateLimiter,
  generalRateLimiter: rateLimiter
};
