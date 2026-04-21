/**
 * 数据库事务使用示例
 * 
 * 本文件展示如何使用增强的数据库事务功能
 * 
 * @module examples/transaction-example
 */

import { executeTransaction, getConnection } from "../db/pool.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger();

/**
 * 示例 1：使用 executeTransaction 执行事务
 * 
 * 场景：批量插入多个 Nullifier，确保原子性
 * 
 * @param {Array<string>} nullifierHashes Nullifier 哈希数组
 */
export async function batchInsertNullifiers(nullifierHashes) {
  try {
    const result = await executeTransaction(async (connection) => {
      const createdAt = Math.floor(Date.now() / 1000);
      let inserted = 0;
      
      for (const hash of nullifierHashes) {
        // 检查是否已存在
        const [rows] = await connection.execute(
          "SELECT nullifier_hash FROM nullifier_registry WHERE nullifier_hash = ?",
          [hash]
        );
        
        if (rows.length > 0) {
          logger.warn("[事务] Nullifier 已存在，跳过", {
            hash: hash.substring(0, 10) + "...",
          });
          continue;
        }
        
        // 插入新记录
        await connection.execute(
          "INSERT INTO nullifier_registry (nullifier_hash, created_at) VALUES (?, ?)",
          [hash, createdAt]
        );
        inserted++;
      }
      
      logger.info("[事务] 批量插入完成", {
        total: nullifierHashes.length,
        inserted,
      });
      
      return { success: true, inserted };
    });
    
    return result;
  } catch (err) {
    logger.error("[事务] 批量插入失败", {
      error: err.message,
      total: nullifierHashes.length,
    });
    throw err;
  }
}

/**
 * 示例 2：使用 getConnection 手动管理事务
 * 
 * 场景：需要更灵活的事务控制
 * 
 * @param {string} claimId 申领 ID
 * @param {string} nullifierHash Nullifier 哈希
 * @param {string} evidenceCid 证据 CID
 */
export async function createClaimWithTransaction(claimId, nullifierHash, evidenceCid) {
  const connection = await getConnection();
  const startTime = Date.now();
  
  try {
    // 手动开启事务
    await connection.beginTransaction();
    logger.debug("[手动事务] 事务已开启");
    
    // 第一步：插入 Nullifier
    await connection.execute(
      "INSERT INTO nullifier_registry (nullifier_hash, created_at) VALUES (?, ?)",
      [nullifierHash, Math.floor(Date.now() / 1000)]
    );
    logger.debug("[手动事务] Nullifier 已插入");
    
    // 第二步：插入申领记录
    await connection.execute(
      `INSERT INTO claim_records
       (claim_id, nullifier_hash, evidence_cid, claimant_address, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        claimId,
        nullifierHash,
        evidenceCid,
        "0x1234567890123456789012345678901234567890",
        "1000",
        "PENDING_REVIEW",
        Math.floor(Date.now() / 1000),
      ]
    );
    logger.debug("[手动事务] 申领记录已插入");
    
    // 提交事务
    await connection.commit();
    const duration = Date.now() - startTime;
    logger.info("[手动事务] 事务提交成功", {
      duration: `${duration}ms`,
    });
    
    return { success: true, claimId };
  } catch (err) {
    // 回滚事务
    try {
      await connection.rollback();
      logger.warn("[手动事务] 事务已回滚", {
        error: err.message,
      });
    } catch (rollbackErr) {
      logger.error("[手动事务] 回滚失败", {
        error: rollbackErr.message,
      });
    }
    throw err;
  } finally {
    // 释放连接
    connection.release();
    logger.debug("[手动事务] 连接已释放");
  }
}

/**
 * 示例 3：使用装饰器模式包装现有函数
 * 
 * 场景：将现有函数升级为事务安全
 */
export async function safeInsertClaimDb(row) {
  return await executeTransaction(async (connection) => {
    const createdAt = Math.floor(Date.now() / 1000);
    
    // 检查 Nullifier 是否已存在
    const [nullifierRows] = await connection.execute(
      "SELECT nullifier_hash FROM nullifier_registry WHERE nullifier_hash = ?",
      [row.nullifierHash]
    );
    
    if (nullifierRows.length > 0) {
      logger.warn("[事务] Nullifier 已存在", {
        claimId: row.claimId,
      });
      return { ok: false, reason: "duplicate_nullifier" };
    }
    
    // 插入 Nullifier
    await connection.execute(
      "INSERT INTO nullifier_registry (nullifier_hash, created_at) VALUES (?, ?)",
      [row.nullifierHash, createdAt]
    );
    
    // 插入申领记录
    await connection.execute(
      `INSERT INTO claim_records
       (claim_id, nullifier_hash, evidence_cid, claimant_address, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.claimId,
        row.nullifierHash,
        row.evidenceCid,
        row.address,
        row.amount,
        row.status || "PENDING_REVIEW",
        createdAt,
      ]
    );
    
    logger.info("[事务] 申领创建成功", {
      claimId: row.claimId,
    });
    
    return { ok: true };
  });
}
