/**
 * Lightweight in-memory sliding-window rate limiter without external dependencies.
 * Suitable for single-node government hospital deployment; keyed by IP + bucket.
 */
const buckets = new Map();

function createRateLimiter({ windowMs = 60000, max = 30, keyPrefix = 'global', message } = {}) {
  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const identifier = req.user?.id ? `u:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    let timestamps = buckets.get(key) || [];
    timestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (timestamps.length >= max) {
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        retry_after_seconds: Math.ceil(windowMs / 1000)
      });
    }

    timestamps.push(now);
    buckets.set(key, timestamps);
    next();
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { createRateLimiter, resetRateLimits };
