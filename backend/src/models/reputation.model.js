/**
 * Reputation Model - 声誉数据访问层
 * 
 * 职责：
 * - 封装声誉评分的数据库操作
 * - 支持声誉历史记录
 * - 支持声誉验证
 */

import pool from '../db/pool.js';

/**
 * 记录声誉历史
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.address - 用户地址
 * @param {number} params.score - 声誉分数
 * @param {string} params.reason - 原因描述
 * @param {string} params.evidenceCid - 证据 CID（IPFS）
 * @returns {Promise<Object>} 插入的记录
 */
export async function insertReputationHistory({ address, score, reason, evidenceCid }) {
  const query = `
    INSERT INTO reputation_history (
      address,
      score,
      reason,
      evidence_cid,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, address, score, reason, created_at
  `;
  
  const values = [address, score, reason, evidenceCid];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * 查询用户声誉历史
 * 
 * @param {string} address - 用户地址
 * @param {number} limit - 每页数量
 * @returns {Promise<Array>} 声誉历史记录列表
 */
export async function getReputationHistory(address, limit = 10) {
  const query = `
    SELECT id, score, reason, evidence_cid, created_at
    FROM reputation_history
    WHERE address = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  
  const result = await pool.query(query, [address, limit]);
  return result.rows;
}

/**
 * 查询用户当前声誉分数
 * 
 * @param {string} address - 用户地址
 * @returns {Promise<number>} 声誉分数
 */
export async function getCurrentReputationScore(address) {
  const query = `
    SELECT score
    FROM reputation_history
    WHERE address = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [address]);
  
  if (result.rows.length === 0) {
    return 0; // 默认分数
  }
  
  return result.rows[0].score;
}

/**
 * 验证声誉分数（ZK 证明用）
 * 
 * @param {string} address - 用户地址
 * @param {number} minScore - 最低分数要求
 * @returns {Promise<boolean>} 是否满足要求
 */
export async function verifyReputation(address, minScore) {
  const currentScore = await getCurrentReputationScore(address);
  return currentScore >= minScore;
}

/**
 * 统计声誉数据
 * 
 * @returns {Promise<Object>} 统计数据
 */
export async function getReputationStats() {
  const query = `
    SELECT 
      COUNT(DISTINCT address) as total_users,
      COUNT(*) as total_records,
      AVG(score) as avg_score,
      MAX(score) as max_score,
      MIN(score) as min_score
    FROM reputation_history
  `;
  
  const result = await pool.query(query);
  const stats = result.rows[0];
  
  return {
    totalUsers: parseInt(stats.total_users, 10),
    totalRecords: parseInt(stats.total_records, 10),
    avgScore: parseFloat(stats.avg_score || 0),
    maxScore: parseInt(stats.max_score || 0),
    minScore: parseInt(stats.min_score || 0),
  };
}
