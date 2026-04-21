-- ============================================================
-- MySQL 数据库验证脚本
-- 用于测试数据库迁移是否成功
-- ============================================================

USE `trustaid_dev`;

-- 1. 验证表数量
SELECT '表数量验证' AS test_name;
SELECT COUNT(*) AS table_count 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'trustaid_dev' 
  AND TABLE_TYPE = 'BASE TABLE';

-- 预期：22 张表

-- 2. 验证核心表是否存在
SELECT '核心表验证' AS test_name;
SELECT TABLE_NAME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'trustaid_dev' 
  AND TABLE_NAME IN (
    'claim_records', 'nullifier_registry', 'identity_commitments',
    'sbt_tokens', 'anonymous_claims'
  )
ORDER BY TABLE_NAME;

-- 预期：5 张核心表都存在

-- 3. 验证 claim_records 表结构
SELECT 'claim_records 表结构' AS test_name;
DESCRIBE claim_records;

-- 4. 验证 identity_commitments 表结构
SELECT 'identity_commitments 表结构' AS test_name;
DESCRIBE identity_commitments;

-- 5. 验证 sbt_tokens 表结构
SELECT 'sbt_tokens 表结构' AS test_name;
DESCRIBE sbt_tokens;

-- 6. 验证索引
SELECT 'claim_records 索引' AS test_name;
SHOW INDEX FROM claim_records;

-- 7. 验证外键约束
SELECT '外键约束验证' AS test_name;
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'trustaid_dev'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 8. 插入测试数据
SELECT '插入测试数据' AS test_name;

-- 测试身份承诺
INSERT INTO identity_commitments (
  commitment, level, banned, expiry_time, registered_at
) VALUES (
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  1, 0, 0, UNIX_TIMESTAMP()
);

-- 测试 SBT 代币
INSERT INTO sbt_tokens (
  token_id, holder_address, commitment, level, credit_score, joined_at
) VALUES (
  'token_001',
  '0xAb58014CD497Cc7356950a960d707C38C8A77f58',
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  1,
  650,
  UNIX_TIMESTAMP()
);

-- 9. 验证测试数据
SELECT '验证测试数据' AS test_name;
SELECT * FROM identity_commitments LIMIT 1;
SELECT * FROM sbt_tokens LIMIT 1;

-- 10. 测试外键约束（应该成功）
SELECT '测试外键约束（成功）' AS test_name;
INSERT INTO whitelist_merkle_leaves (
  commitment, user_level, merkle_leaf, leaf_index, merkle_root, created_at
) VALUES (
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  1,
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  0,
  '0xroot1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  UNIX_TIMESTAMP()
);

-- 11. 查看所有表的数据量
SELECT '表数据统计' AS test_name;
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'trustaid_dev'
ORDER BY TABLE_NAME;

-- 12. 清理测试数据（可选）
-- DELETE FROM whitelist_merkle_leaves WHERE commitment = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
-- DELETE FROM sbt_tokens WHERE token_id = 'token_001';
-- DELETE FROM identity_commitments WHERE commitment = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

SELECT '验证完成' AS test_name;
