/**
 * 限流中间件
 * 
 * 功能：
 * - 基于滑动窗口限流
 * - 自动清理过期缓存（防内存泄漏）
 * - 支持自定义限流键
 * 
 * 安全说明：
 * - 使用 IP 或用户地址作为限流键
 * - 防止暴力破解和 DDoS 攻击
 * 
 * @param {Object} options 限流配置
 * @param {number} options.windowMs 时间窗口（毫秒），默认 60 秒
 * @param {number} options.max 最大请求数，默认 20 次
 * @param {Function} options.keyFn 自定义限流键生成函数
 * @returns {Function} Express 中间件函数
 */
const hits = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 分钟清理一次

/**
 * 清理过期的限流记录（防内存泄漏）
 * 
 * 清理策略：
 * - 移除所有时间窗口外的记录
 * - 移除空 bucket
 * - 定期执行（每 5 分钟）
 */
function cleanupExpiredHits() {
  const now = Date.now();
  let cleaned = 0;
  
  hits.forEach((bucket, key) => {
    // 过滤出时间窗口内的请求
    const validBucket = bucket.filter(t => now - t < 60 * 60 * 1000); // 保留 1 小时内的记录
    if (validBucket.length === 0) {
      hits.delete(key);
      cleaned++;
    } else {
      hits.set(key, validBucket);
    }
  });
  
  if (cleaned > 0) {
    console.log(`[rate-limit] 清理了 ${cleaned} 个过期记录，当前缓存数：${hits.size}`);
  }
}

// 启动定期清理任务
if (!global.rateLimitCleanupInterval) {
  global.rateLimitCleanupInterval = setInterval(cleanupExpiredHits, CLEANUP_INTERVAL);
  console.log(`[rate-limit] 已启动定期清理任务（间隔：${CLEANUP_INTERVAL / 1000}秒）`);
}

export function rateLimit({ windowMs = 60_000, max = 20, keyFn } = {}) {
  const resolvedKeyFn =
    typeof keyFn === "function"
      ? keyFn
      : (req) => req.auth?.address || req.user?.address || req.ip;

  return function rateLimitMiddleware(req, res, next) {
    const key = resolvedKeyFn(req);
    const now = Date.now();
    
    // 获取并清理当前 bucket 的过期记录
    let bucket = hits.get(key) || [];
    bucket = bucket.filter((t) => now - t < windowMs);
    
    // 检查是否超出限流
    if (bucket.length >= max) {
      // 计算剩余等待时间
      const oldestHit = Math.min(...bucket);
      const retryAfter = Math.ceil((oldestHit + windowMs - now) / 1000);
      
      // 设置限流响应头
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Reset", String(Math.ceil((oldestHit + windowMs) / 1000)));
      res.set("Retry-After", String(retryAfter));
      
      return res.status(429).json({ 
        code: 9001, 
        error: "请求过于频繁",
        retryAfter, // 秒数
        limit: max,
        window: windowMs / 1000
      });
    }
    
    // 记录当前请求
    bucket.push(now);
    hits.set(key, bucket);
    
    // 设置响应头（当前剩余次数）
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(max - bucket.length));
    res.set("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
    
    return next();
  };
}

/**
 * 获取当前限流状态（用于监控）
 * 
 * @param {string} key 限流键
 * @param {number} windowMs 时间窗口
 * @returns {Object} 限流状态信息
 */
export function getRateLimitStatus(key, windowMs = 60_000) {
  const bucket = hits.get(key) || [];
  const now = Date.now();
  const validBucket = bucket.filter((t) => now - t < windowMs);
  
  return {
    totalRequests: bucket.length,
    recentRequests: validBucket.length,
    oldestHit: validBucket.length > 0 ? Math.min(...validBucket) : null,
    cacheSize: hits.size
  };
}
