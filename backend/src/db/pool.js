import mysql from "mysql2/promise";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger();

let pool = null;

/**
 * 获取 MySQL 连接池
 * 
 * 连接池配置：
 * - max: 最大连接数 10
 * - idleTimeout: 空闲超时 30 秒
 * - connectTimeout: 连接超时 5 秒
 * - acquireTimeout: 获取连接超时 10 秒
 * 
 * @returns {mysql.Pool|null} MySQL 连接池或 null
 */
export function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    // MySQL 连接池配置（mysql2 支持 Promise）
    pool = mysql.createPool({
      uri: config.databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      idleTimeout: 30000,
      connectTimeout: 5000,
      acquireTimeout: 10000,
      // 启用连接测试
      enableKeepAlive: true,
      keepAliveInitialDelay: 1000,
    });
    
    // 监听连接事件（用于监控）
    pool.on("connection", (connection) => {
      logger.debug("[DB] 新连接建立", {
        threadId: connection.threadId,
      });
    });
    
    // 监听连接错误（不阻断服务）
    pool.on("error", (err) => {
      logger.warn("[DB] 连接池错误", {
        error: err.message,
        code: err.code,
      });
    });
    
    // 监听连接释放
    pool.on("release", (connection) => {
      logger.debug("[DB] 连接已释放", {
        threadId: connection.threadId,
      });
    });
  }
  return pool;
}

/**
 * 获取数据库连接（用于事务）
 * 
 * 使用示例：
 *   const connection = await getConnection();
 *   try {
 *     await connection.beginTransaction();
 *     // ... 执行操作
 *     await connection.commit();
 *   } catch (err) {
 *     await connection.rollback();
 *     throw err;
 *   } finally {
 *     await connection.release();
 *   }
 * 
 * @returns {Promise<mysql.PoolConnection>} 数据库连接
 */
export async function getConnection() {
  const p = getPool();
  if (!p) {
    throw new Error("数据库未配置");
  }
  return await p.getConnection();
}

/**
 * 执行数据库事务
 * 
 * 自动处理 begin/commit/rollback，确保连接释放
 * 
 * @param {Function} callback - 事务回调函数，接收 connection 参数
 * @returns {Promise<any>} 事务执行结果
 * 
 * @example
 * await executeTransaction(async (connection) => {
 *   await connection.execute("INSERT INTO ...");
 *   await connection.execute("UPDATE ...");
 *   return { success: true };
 * });
 */
export async function executeTransaction(callback) {
  const p = getPool();
  if (!p) {
    throw new Error("数据库未配置");
  }
  
  const connection = await getConnection();
  const startTime = Date.now();
  
  try {
    // 开启事务
    await connection.beginTransaction();
    logger.debug("[DB] 事务已开启", {
      threadId: connection.threadId,
    });
    
    // 执行用户操作
    const result = await callback(connection);
    
    // 提交事务
    await connection.commit();
    const duration = Date.now() - startTime;
    logger.info("[DB] 事务提交成功", {
      threadId: connection.threadId,
      duration: `${duration}ms`,
    });
    
    return result;
  } catch (err) {
    // 回滚事务
    try {
      await connection.rollback();
      logger.warn("[DB] 事务已回滚", {
        threadId: connection.threadId,
        error: err.message,
      });
    } catch (rollbackErr) {
      logger.error("[DB] 回滚失败", {
        threadId: connection.threadId,
        error: rollbackErr.message,
      });
    }
    throw err;
  } finally {
    // 释放连接（无论如何都要执行）
    connection.release();
    logger.debug("[DB] 连接已释放", {
      threadId: connection.threadId,
    });
  }
}

/**
 * 插入 Nullifier 到数据库（防重放机制）
 * 
 * 隐私保护说明：
 * - nullifierHash 已为哈希值，不包含原始身份数据
 * - 使用参数化查询防止 SQL 注入
 * 
 * @param {string} nullifierHash Nullifier 哈希值
 * @returns {Promise<{ok: boolean, skipped?: boolean}>} 操作结果
 */
export async function insertNullifierDb(nullifierHash) {
  const p = getPool();
  if (!p) return { ok: true, skipped: true };
  const createdAt = Math.floor(Date.now() / 1000);
  try {
    // MySQL 使用 ? 占位符（PostgreSQL 使用 $1, $2）
    await p.execute(
      "INSERT INTO nullifier_registry (nullifier_hash, created_at) VALUES (?, ?)",
      [nullifierHash, createdAt]
    );
    return { ok: true };
  } catch (e) {
    // MySQL 唯一约束错误码：ER_DUP_ENTRY (1062)
    if (String(e.errno) === "1062") {
      const err = new Error("duplicate nullifier");
      err.code = "DUPLICATE_NULLIFIER";
      throw err;
    }
    return { ok: true, skipped: true, reason: e.message };
  }
}

/**
 * 统计 Nullifier 总数
 * 
 * 用途：健康检查、监控
 * 
 * @returns {Promise<number|null>} Nullifier 数量或 null
 */
export async function countNullifiers() {
  const p = getPool();
  if (!p) return null;
  try {
    // MySQL 语法：直接返回 COUNT(*)，无需 ::int 转换
    const [rows] = await p.execute("SELECT COUNT(*) AS c FROM nullifier_registry");
    return Number(rows[0].c); // 确保返回数字类型
  } catch (e) {
    console.warn("[pool] countNullifiers failed:", e.message, e);
    return null;
  }
}

/**
 * 插入申领记录到数据库
 * 
 * 隐私保护说明：
 * - address 已转为小写，不包含敏感信息
 * - amount 为字符串，避免精度丢失
 * - 使用 ON DUPLICATE KEY UPDATE 替代 ON CONFLICT
 * 
 * @param {Object} row 申领记录对象
 * @returns {Promise<{ok: boolean, skipped?: boolean}>} 操作结果
 */
export async function insertClaimDb(row) {
  const p = getPool();
  if (!p) return { ok: true, skipped: true };
  try {
    // MySQL 使用 ON DUPLICATE KEY UPDATE 替代 PostgreSQL 的 ON CONFLICT DO NOTHING
    await p.execute(
      `INSERT INTO claim_records
         (claim_id, nullifier_hash, evidence_cid, claimant_address, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE claim_id = claim_id`,
      [
        row.claimId,
        row.nullifierHash,
        row.evidenceCid,
        row.address,
        row.amount,
        row.status || "PENDING_REVIEW",
        row.createdAt,
      ]
    );
    return { ok: true };
  } catch (e) {
    console.warn("[pool] insertClaimDb failed:", e.message);
    return { ok: true, skipped: true };
  }
}
