/**
 * Claim Model - 空投申领数据访问层
 * 
 * 职责：
 * - 封装空投申领的数据库操作
 * - 支持匿名申领和实名申领
 * - 防重放攻击（Nullifier 检查）
 * 
 * 隐私保护：
 * - 仅存储哈希值，不存储原始数据
 * - 支持零知识证明验证
 */

import pool from '../db/pool.js';
import { hashForLogging } from '../utils/logger.js';

/**
 * 插入空投申领记录
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.nullifierHash - 空值哈希（防重放）
 * @param {string} params.commitment - 身份承诺
 * @param {number} params.amount - 申领金额
 * @param {string} params.evidenceCid - 证据 CID（IPFS）
 * @param {boolean} params.isAnonymous - 是否匿名申领
 * @returns {Promise<Object>} 插入的记录
 */
export async function insertClaim({ nullifierHash, commitment, amount, evidenceCid, isAnonymous = false }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 检查 nullifier 是否已使用（防重放）
    const existing = await isNullifierUsed(nullifierHash);
    if (existing) {
      throw new Error('[Model 验证] Nullifier 已使用，拒绝重复申领');
    }
    
    const query = `
      INSERT INTO claims (
        nullifier_hash,
        commitment,
        amount,
        evidence_cid,
        is_anonymous,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, nullifier_hash, amount, is_anonymous, created_at
    `;
    
    const values = [nullifierHash, commitment, amount, evidenceCid, isAnonymous];
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    // 日志脱敏
    console.log(JSON.stringify({
      event: 'CLAIM_INSERTED',
      nullifierHash: hashForLogging(nullifierHash),
      amount,
      isAnonymous,
    }));
    
    return result.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(JSON.stringify({
      event: 'CLAIM_INSERT_FAILED',
      nullifierHash: hashForLogging(nullifierHash),
      error: error.message,
    }));
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 检查 Nullifier 是否已使用
 * 
 * @param {string} nullifierHash - 空值哈希
 * @returns {Promise<boolean>} 是否已使用
 */
export async function isNullifierUsed(nullifierHash) {
  const query = `
    SELECT COUNT(*) as count
    FROM claims
    WHERE nullifier_hash = $1
  `;
  
  const result = await pool.query(query, [nullifierHash]);
  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * 查询申领记录
 * 
 * @param {number} claimId - 申领 ID
 * @returns {Promise<Object|null>} 申领记录或 null
 */
export async function getClaimById(claimId) {
  const query = `
    SELECT id, nullifier_hash, commitment, amount, evidence_cid, is_anonymous, created_at
    FROM claims
    WHERE id = $1
    LIMIT 1
  `;
  
  const result = await pool.query(query, [claimId]);
  return result.rows[0] || null;
}

/**
 * 批量查询申领记录（分页）
 * 
 * @param {number} limit - 每页数量
 * @param {number} offset - 偏移量
 * @returns {Promise<Array>} 申领记录列表
 */
export async function getClaims(limit = 10, offset = 0) {
  const query = `
    SELECT id, nullifier_hash, amount, is_anonymous, created_at
    FROM claims
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

/**
 * 统计申领数据
 * 
 * @returns {Promise<Object>} 统计数据
 */
export async function getClaimStats() {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_anonymous = true) as anonymous,
      COUNT(*) FILTER (WHERE is_anonymous = false) as identified,
      COALESCE(SUM(amount), 0) as total_amount
    FROM claims
  `;
  
  const result = await pool.query(query);
  const stats = result.rows[0];
  
  return {
    total: parseInt(stats.total, 10),
    anonymous: parseInt(stats.anonymous, 10),
    identified: parseInt(stats.identified, 10),
    totalAmount: parseInt(stats.total_amount, 10),
  };
}
