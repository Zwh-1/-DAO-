/**
 * Identity Model - 身份数据访问层
 * 
 * 职责：
 * - 封装数据库操作，隔离业务逻辑与 SQL 实现
 * - 提供统一的身份数据访问接口
 * - 确保数据一致性和事务安全
 * 
 * 隐私保护：
 * - 不存储明文身份数据，仅存储哈希承诺
 * - 支持数据最小化原则（GDPR/PIPL 合规）
 * - 敏感字段自动脱敏
 * 
 * 安全规范：
 * - 参数化查询：防止 SQL 注入
 * - 事务安全：支持回滚
 * - 日志脱敏：不记录明文承诺值
 */

import pool from '../db/pool.js';
import { hashForLogging } from '../utils/logger.js';

/**
 * 插入身份承诺记录
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.commitment - 身份承诺哈希（Poseidon 哈希结果）
 * @param {string} params.nullifier - 空值标识（防重放）
 * @param {number} params.level - 信任等级（0-5）
 * @param {number} params.expiry - 过期时间戳（秒）
 * @param {boolean} params.isBanned - 是否被封禁
 * @returns {Promise<Object>} 插入的记录（包含 id）
 * 
 * 安全注释：
 * - 参数化查询：使用 $1, $2 占位符，防止 SQL 注入
 * - 事务安全：支持回滚，确保数据一致性
 * - 隐私保护：不记录明文 commitment，仅记录哈希值
 * 
 * 业务规则：
 * - level 必须在 0-5 范围内
 * - expiry 必须是未来时间戳
 * - nullifier 必须唯一（防重放攻击）
 * 
 * @throws {Error} 当数据库操作失败或参数验证失败时抛出错误
 */
export async function insertIdentityCommitment({ commitment, nullifier, level, expiry, isBanned = false }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 参数验证
    if (!commitment || commitment.length === 0) {
      throw new Error('[Model 验证] commitment 不能为空');
    }
    
    if (!nullifier || nullifier.length === 0) {
      throw new Error('[Model 验证] nullifier 不能为空');
    }
    
    if (level < 0 || level > 5) {
      throw new Error('[Model 验证] level 必须在 0-5 范围内');
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (expiry <= now) {
      throw new Error('[Model 验证] expiry 必须是未来时间戳');
    }
    
    // 插入数据库
    const query = `
      INSERT INTO identity_commitments (
        commitment,
        nullifier,
        trust_level,
        expiry_timestamp,
        is_banned,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, commitment, nullifier, trust_level, expiry_timestamp, is_banned, created_at
    `;
    
    const values = [commitment, nullifier, level, expiry, isBanned];
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    // 日志脱敏：不记录明文 commitment
    console.log(JSON.stringify({
      event: 'IDENTITY_INSERTED',
      commitmentHash: hashForLogging(commitment),
      level,
      expiry,
    }));
    
    return result.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    // 错误日志脱敏
    console.error(JSON.stringify({
      event: 'IDENTITY_INSERT_FAILED',
      commitmentHash: hashForLogging(commitment),
      error: error.message,
    }));
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 查询身份承诺状态
 * 
 * @param {string} commitment - 身份承诺哈希
 * @returns {Promise<Object|null>} 承诺记录或 null
 * 
 * 隐私注释：
 * - 不返回原始身份数据，仅返回承诺哈希
 * - 支持零知识验证：前端可通过承诺反推，后端不持有见证人数据
 * 
 * 使用场景：
 * - 验证用户身份是否已注册
 * - 检查承诺是否过期
 * - 查询信任等级
 */
export async function getIdentityByCommitment(commitment) {
  const query = `
    SELECT 
      id,
      commitment,
      nullifier,
      trust_level,
      expiry_timestamp,
      is_banned,
      created_at
    FROM identity_commitments
    WHERE commitment = $1
    LIMIT 1
  `;
  
  const result = await pool.query(query, [commitment]);
  return result.rows[0] || null;
}

/**
 * 通过 nullifier 查询（防重放检查）
 * 
 * @param {string} nullifier - 空值标识
 * @returns {Promise<boolean>} 是否已存在
 * 
 * 安全注释：
 * - 用于检测重放攻击
 * - 如果 nullifier 已存在，说明该用户已领取过空投
 * 
 * 业务规则：
 * - 每个 nullifier 只能使用一次
 * - 重复使用 nullifier 会被拒绝
 */
export async function isNullifierUsed(nullifier) {
  const query = `
    SELECT COUNT(*) as count
    FROM identity_commitments
    WHERE nullifier = $1
  `;
  
  const result = await pool.query(query, [nullifier]);
  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * 批量查询过期承诺（用于清理任务）
 * 
 * @param {number} timestamp - 当前时间戳
 * @returns {Promise<Array>} 过期承诺列表
 * 
 * 使用场景：
 * - 定时任务清理过期数据
 * - 释放存储空间
 * - 符合数据最小化原则
 */
export async function getExpiredCommitments(timestamp) {
  const query = `
    SELECT id, commitment, nullifier
    FROM identity_commitments
    WHERE expiry_timestamp < $1
      AND is_banned = false
    ORDER BY expiry_timestamp ASC
  `;
  
  const result = await pool.query(query, [timestamp]);
  return result.rows;
}

/**
 * 更新承诺信任等级
 * 
 * @param {string} commitment - 身份承诺哈希
 * @param {number} newLevel - 新的信任等级（0-5）
 * @returns {Promise<Object>} 更新后的记录
 * 
 * 业务规则：
 * - 仅 oracle 角色可以更新等级
 * - level 必须在 0-5 范围内
 * - 承诺必须存在且未过期
 */
export async function updateCommitmentLevel(commitment, newLevel) {
  if (newLevel < 0 || newLevel > 5) {
    throw new Error('[Model 验证] newLevel 必须在 0-5 范围内');
  }
  
  const query = `
    UPDATE identity_commitments
    SET trust_level = $2,
        updated_at = NOW()
    WHERE commitment = $1
      AND expiry_timestamp > EXTRACT(EPOCH FROM NOW())
    RETURNING id, commitment, trust_level, expiry_timestamp
  `;
  
  const result = await pool.query(query, [commitment, newLevel]);
  
  if (result.rows.length === 0) {
    throw new Error('[Model 验证] 承诺不存在或已过期');
  }
  
  return result.rows[0];
}

/**
 * 封禁身份承诺
 * 
 * @param {string} commitment - 身份承诺哈希
 * @returns {Promise<Object>} 更新后的记录
 * 
 * 使用场景：
 * - 检测到作弊行为
 * - 女巫攻击识别
 * - 违规操作处罚
 */
export async function banIdentityCommitment(commitment) {
  const query = `
    UPDATE identity_commitments
    SET is_banned = true,
        banned_at = NOW()
    WHERE commitment = $1
    RETURNING id, commitment, is_banned, banned_at
  `;
  
  const result = await pool.query(query, [commitment]);
  
  if (result.rows.length === 0) {
    throw new Error('[Model 验证] 承诺不存在');
  }
  
  return result.rows[0];
}

/**
 * 统计承诺数量（用于监控）
 * 
 * @returns {Promise<Object>} 统计数据
 * 
 * 返回字段：
 * - total: 总数量
 * - active: 活跃数量（未过期、未封禁）
 * - banned: 封禁数量
 * - expired: 过期数量
 */
export async function getIdentityStats() {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (
        WHERE expiry_timestamp > EXTRACT(EPOCH FROM NOW())
        AND is_banned = false
      ) as active,
      COUNT(*) FILTER (WHERE is_banned = true) as banned,
      COUNT(*) FILTER (
        WHERE expiry_timestamp <= EXTRACT(EPOCH FROM NOW())
      ) as expired
    FROM identity_commitments
  `;
  
  const result = await pool.query(query);
  const stats = result.rows[0];
  
  return {
    total: parseInt(stats.total, 10),
    active: parseInt(stats.active, 10),
    banned: parseInt(stats.banned, 10),
    expired: parseInt(stats.expired, 10),
  };
}

/**
 * 删除过期承诺（清理任务）
 * 
 * @param {number} timestamp - 当前时间戳
 * @returns {Promise<number>} 删除的记录数
 * 
 * 隐私保护：
 * - 符合数据最小化原则
 * - 定期清理过期数据
 * 
 * 使用场景：
 * - 定时任务（每天执行）
 * - 释放存储空间
 */
export async function deleteExpiredCommitments(timestamp) {
  const query = `
    DELETE FROM identity_commitments
    WHERE expiry_timestamp < $1
  `;
  
  const result = await pool.query(query, [timestamp]);
  return result.rowCount;
}
