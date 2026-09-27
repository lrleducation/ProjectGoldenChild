const buckets = new Map();

function rateLimit(key, { limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  current.count += 1;
  if (current.count > limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((current.reset - now) / 1000) };
  return { ok: true, remaining: limit - current.count };
}

module.exports = { rateLimit };
