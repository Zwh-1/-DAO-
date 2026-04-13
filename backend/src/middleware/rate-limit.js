const hits = new Map();

export function rateLimit({ windowMs = 60_000, max = 20, keyFn } = {}) {
  const resolvedKeyFn =
    typeof keyFn === "function"
      ? keyFn
      : (req) => req.auth?.address || req.user?.address || req.ip;

  return function rateLimitMiddleware(req, res, next) {
    const key = resolvedKeyFn(req);
    const now = Date.now();
    let bucket = hits.get(key) || [];
    bucket = bucket.filter((t) => now - t < windowMs);
    if (bucket.length >= max) {
      return res.status(429).json({ code: 9001, error: "请求过于频繁" });
    }
    bucket.push(now);
    hits.set(key, bucket);
    return next();
  };
}
