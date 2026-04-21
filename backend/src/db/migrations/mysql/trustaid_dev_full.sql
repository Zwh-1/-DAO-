-- ============================================================
-- TrustAID Platform - Full Database Schema
-- Generated from fixed migration files (MySQL 8.0+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `trustaid_dev` 
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `trustaid_dev`;

-- ============================================================
-- 001_init_fixed.sql - 基础表结构
-- ============================================================

-- 申领记录表
CREATE TABLE IF NOT EXISTS `claim_records` (
  `claim_id` VARCHAR(100) NOT NULL COMMENT '申领 ID',
  `nullifier_hash` VARCHAR(66) NOT NULL COMMENT 'Nullifier 哈希',
  `evidence_cid` VARCHAR(100) NOT NULL COMMENT 'IPFS 证据 CID',
  `claimant_address` VARCHAR(42) NOT NULL COMMENT '申领人地址',
  `amount` VARCHAR(40) NOT NULL COMMENT '申领金额（wei 字符串）',
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW' COMMENT '状态',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`claim_id`),
  UNIQUE INDEX `uk_nullifier_hash` (`nullifier_hash`),
  INDEX `idx_claimant` (`claimant_address`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='申领记录表';

-- Nullifier 注册表（防重放）
CREATE TABLE IF NOT EXISTS `nullifier_registry` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `nullifier_hash` VARCHAR(66) NOT NULL COMMENT 'Nullifier 哈希',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_nullifier_hash` (`nullifier_hash`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nullifier 注册表';

-- 钱包绑定表
CREATE TABLE IF NOT EXISTS `wallet_bindings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `main_address` VARCHAR(42) NOT NULL COMMENT '主钱包地址',
  `linked_address` VARCHAR(42) NOT NULL COMMENT '关联钱包地址',
  `proof_digest` TEXT NOT NULL COMMENT '证明摘要',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_main_linked` (`main_address`, `linked_address`),
  INDEX `idx_main_address` (`main_address`),
  INDEX `idx_linked_address` (`linked_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='钱包绑定表';

-- ============================================================
-- 002_indexes_fixed.sql - 额外索引与 identity 表
-- ============================================================

DROP PROCEDURE IF EXISTS `add_index_if_missing`;
DELIMITER $$
CREATE PROCEDURE `add_index_if_missing`(
  IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @sql = ddl;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;
CALL `add_index_if_missing`('claim_records','uk_claim_nullifier',
  'CREATE UNIQUE INDEX `uk_claim_nullifier` ON `claim_records` (`nullifier_hash`)');
CALL `add_index_if_missing`('claim_records','idx_claims_claimant',
  'CREATE INDEX `idx_claims_claimant` ON `claim_records` (`claimant_address`)');
DROP PROCEDURE IF EXISTS `add_index_if_missing`;

-- Identity 表（身份承诺）
CREATE TABLE IF NOT EXISTS `identities` (
  `commitment` VARCHAR(80) NOT NULL COMMENT '身份承诺（Poseidon 哈希）',
  `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '用户等级 1-5',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`commitment`),
  UNIQUE INDEX `uk_commitment` (`commitment`),
  INDEX `idx_level` (`level`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='身份承诺表';

-- ============================================================
-- 003_blacklist_fixed.sql - 黑名单与审计日志
-- ============================================================

-- 黑名单表
CREATE TABLE IF NOT EXISTS `blacklist` (
  `commitment` VARCHAR(80) NOT NULL COMMENT '身份承诺',
  `reason` TEXT NOT NULL COMMENT '封禁原因',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`commitment`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='黑名单表';

-- 审计日志表
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `event_type` VARCHAR(50) NOT NULL COMMENT '事件类型',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '交易哈希',
  `payload` JSON DEFAULT NULL COMMENT '事件数据（JSON）',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_tx_hash` (`tx_hash`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表';

-- ============================================================
-- 004_governance_fixed.sql - DAO 治理 / 守护者审计 / 预言机多签报告
-- ============================================================

-- 治理提案表
CREATE TABLE IF NOT EXISTS `gov_proposals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `description` TEXT NOT NULL COMMENT '提案描述',
  `proposer` VARCHAR(42) NOT NULL COMMENT '提案人地址',
  `for_votes` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '赞成票数',
  `against_votes` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '反对票数',
  `abstain_votes` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '弃权票数',
  `state` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '状态 (1=Active 2=Passed 3=Defeated 4=Queued 5=Executed 6=Cancelled)',
  `start_time` BIGINT NOT NULL COMMENT '开始时间戳',
  `end_time` BIGINT NOT NULL COMMENT '结束时间戳',
  `queued_at` BIGINT DEFAULT NULL COMMENT '排队时间戳',
  `executed_at` BIGINT DEFAULT NULL COMMENT '执行时间戳',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_state` (`state`),
  INDEX `idx_proposer` (`proposer`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='治理提案表';

-- 投票记录表
CREATE TABLE IF NOT EXISTS `gov_votes` (
  `proposal_id` BIGINT UNSIGNED NOT NULL COMMENT '提案 ID',
  `voter` VARCHAR(42) NOT NULL COMMENT '投票人地址',
  `support` TINYINT UNSIGNED NOT NULL COMMENT '支持 (0=against 1=for 2=abstain)',
  `weight` BIGINT UNSIGNED NOT NULL DEFAULT 10 COMMENT '权重',
  `voted_at` BIGINT NOT NULL COMMENT '投票时间戳',
  PRIMARY KEY (`proposal_id`, `voter`),
  INDEX `idx_voter` (`voter`),
  INDEX `idx_voted_at` (`voted_at`),
  CONSTRAINT `fk_gov_votes_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `gov_proposals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='投票记录表';

-- 守护者审计日志表
CREATE TABLE IF NOT EXISTS `guardian_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `action` VARCHAR(20) NOT NULL COMMENT '操作 (PAUSE/RESUME/BAN/UNBAN)',
  `target` VARCHAR(42) DEFAULT NULL COMMENT '目标地址',
  `performed_by` VARCHAR(255) NOT NULL COMMENT '执行人',
  `reason` TEXT NOT NULL COMMENT '原因',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_target` (`target`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='守护者审计日志表';

-- 守护者黑名单表
CREATE TABLE IF NOT EXISTS `guardian_blacklist` (
  `address` VARCHAR(42) NOT NULL COMMENT '地址',
  `reason` TEXT NOT NULL COMMENT '封禁原因',
  `banned_by` VARCHAR(255) NOT NULL COMMENT '执行人',
  `banned_at` BIGINT NOT NULL COMMENT '封禁时间戳',
  `lifted_at` BIGINT DEFAULT NULL COMMENT '解除时间戳 (NULL 表示仍在黑名单)',
  PRIMARY KEY (`address`),
  INDEX `idx_banned_at` (`banned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='守护者黑名单表';

-- 预言机报告表
CREATE TABLE IF NOT EXISTS `oracle_reports` (
  `report_id` VARCHAR(100) NOT NULL COMMENT '报告 ID',
  `claim_id` VARCHAR(100) NOT NULL COMMENT '申领 ID',
  `data_hash` VARCHAR(66) NOT NULL COMMENT '数据哈希 (SHA-256)',
  `signers` JSON NOT NULL COMMENT '签名者列表 (JSON 数组)',
  `fast_track` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '快速通道 (0 否 1 是)',
  `finalized` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已定稿 (0 否 1 是)',
  `approved` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已批准 (0 否 1 是)',
  `created_at` BIGINT NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`report_id`),
  INDEX `idx_claim_id` (`claim_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预言机报告表';

-- ============================================================
-- 005_identity_fixed.sql - 身份承诺、SBT 代币与白名单 Merkle 树
-- ============================================================

-- 身份承诺注册表
CREATE TABLE IF NOT EXISTS `identity_commitments` (
  `commitment` VARCHAR(80) NOT NULL COMMENT '身份承诺 (Poseidon(social_id_hash, secret, trapdoor))',
  `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '用户等级 1-5',
  `banned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否被封禁 (0 否 1 是)',
  `expiry_time` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '过期时间戳 (0=永不过期)',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '链上注册交易哈希',
  `registered_at` BIGINT UNSIGNED NOT NULL COMMENT '注册时间戳',
  PRIMARY KEY (`commitment`),
  INDEX `idx_level` (`level`),
  INDEX `idx_banned` (`banned`),
  INDEX `idx_registered_at` (`registered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='身份承诺注册表';

-- SBT 代币表
CREATE TABLE IF NOT EXISTS `sbt_tokens` (
  `token_id` VARCHAR(80) NOT NULL COMMENT '代币 ID',
  `holder_address` VARCHAR(42) NOT NULL COMMENT '持有者地址',
  `commitment` VARCHAR(80) NOT NULL COMMENT '身份承诺',
  `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '等级',
  `credit_score` SMALLINT UNSIGNED NOT NULL DEFAULT 650 COMMENT '信用分数 (0-1000)',
  `joined_at` BIGINT UNSIGNED NOT NULL COMMENT '加入时间戳',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '交易哈希',
  PRIMARY KEY (`token_id`),
  UNIQUE INDEX `uk_holder_address` (`holder_address`),
  INDEX `idx_commitment` (`commitment`),
  INDEX `idx_level` (`level`),
  INDEX `idx_credit_score` (`credit_score`),
  CONSTRAINT `fk_sbt_identity` FOREIGN KEY (`commitment`) REFERENCES `identity_commitments` (`commitment`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SBT 代币表';

-- 白名单 Merkle 树叶子表
CREATE TABLE IF NOT EXISTS `whitelist_merkle_leaves` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `commitment` VARCHAR(80) NOT NULL COMMENT '身份承诺',
  `user_level` SMALLINT UNSIGNED NOT NULL COMMENT '用户等级',
  `merkle_leaf` VARCHAR(80) NOT NULL COMMENT 'Merkle 树叶子 (Poseidon(commitment, level))',
  `leaf_index` INT UNSIGNED NOT NULL COMMENT '叶子索引',
  `merkle_root` VARCHAR(80) NOT NULL COMMENT '插入后的树根',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_merkle_leaf` (`merkle_leaf`),
  INDEX `idx_commitment` (`commitment`),
  INDEX `idx_merkle_root` (`merkle_root`),
  CONSTRAINT `fk_whitelist_identity` FOREIGN KEY (`commitment`) REFERENCES `identity_commitments` (`commitment`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='白名单 Merkle 树叶子表';

-- ============================================================
-- 006_anonymous_claim_fixed.sql - 匿名申领记录
-- ============================================================

CREATE TABLE IF NOT EXISTS `anonymous_claims` (
  `nullifier` VARCHAR(80) NOT NULL COMMENT 'Nullifier (Poseidon(secret, airdrop_id))',
  `amount` VARCHAR(40) NOT NULL COMMENT '金额 (wei 字符串)',
  `recipient` VARCHAR(42) DEFAULT NULL COMMENT '接收地址 (可为空以保护隐私)',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '交易哈希',
  `claimed_at` BIGINT UNSIGNED NOT NULL COMMENT '申领时间戳',
  PRIMARY KEY (`nullifier`),
  INDEX `idx_claimed_at` (`claimed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匿名申领记录表';

-- ============================================================
-- 007_channels_fixed.sql - 支付通道与保密转账
-- ============================================================

-- 支付通道表
CREATE TABLE IF NOT EXISTS `payment_channels` (
  `channel_id` VARCHAR(80) NOT NULL COMMENT '通道 ID',
  `channel_address` VARCHAR(42) DEFAULT NULL COMMENT '链上合约地址',
  `participant1` VARCHAR(42) NOT NULL COMMENT '参与者 1 地址',
  `participant2` VARCHAR(42) NOT NULL COMMENT '参与者 2 地址',
  `total_deposit` VARCHAR(40) NOT NULL COMMENT '总存款 (wei)',
  `current_nonce` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当前随机数',
  `balance1` VARCHAR(40) NOT NULL COMMENT '参与者 1 余额',
  `balance2` VARCHAR(40) NOT NULL COMMENT '参与者 2 余额',
  `exit_initiated` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已发起退出 (0 否 1 是)',
  `close_requested_at` BIGINT UNSIGNED DEFAULT NULL COMMENT '挑战期开始时间戳',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`channel_id`),
  INDEX `idx_participant1` (`participant1`),
  INDEX `idx_participant2` (`participant2`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付通道表';

-- 通道状态历史表
CREATE TABLE IF NOT EXISTS `channel_states` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `channel_id` VARCHAR(80) NOT NULL COMMENT '通道 ID',
  `nonce` BIGINT UNSIGNED NOT NULL COMMENT '随机数',
  `balance1` VARCHAR(40) NOT NULL COMMENT '参与者 1 余额',
  `balance2` VARCHAR(40) NOT NULL COMMENT '参与者 2 余额',
  `updated_at` BIGINT UNSIGNED NOT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_channel_nonce` (`channel_id`, `nonce`),
  INDEX `idx_updated_at` (`updated_at`),
  CONSTRAINT `fk_channel_states` FOREIGN KEY (`channel_id`) REFERENCES `payment_channels` (`channel_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通道状态历史表';

-- 保密转账 Nullifiers 表
CREATE TABLE IF NOT EXISTS `confidential_transfers` (
  `nullifier` VARCHAR(80) NOT NULL COMMENT 'Nullifier (Poseidon(amount, salt, transaction_id))',
  `transaction_id` VARCHAR(80) NOT NULL COMMENT '交易 ID',
  `amount_commitment` VARCHAR(80) NOT NULL COMMENT '金额承诺 (Poseidon(amount, salt))',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '链上中继交易哈希',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`nullifier`),
  INDEX `idx_transaction_id` (`transaction_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='保密转账 Nullifiers 表';

-- ============================================================
-- 008_reputation_fixed.sql - 声誉系统与历史行为锚定
-- ============================================================

-- 声誉验证记录表
CREATE TABLE IF NOT EXISTS `reputation_scores` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `address` VARCHAR(42) NOT NULL COMMENT '地址',
  `reputation_hash` VARCHAR(80) NOT NULL COMMENT '声誉哈希 (Poseidon(total_score))',
  `required_score` INT UNSIGNED NOT NULL COMMENT '所需分数下限',
  `proof_hash` VARCHAR(66) NOT NULL COMMENT 'ZK 证明摘要 (审计用)',
  `verified_at` BIGINT UNSIGNED NOT NULL COMMENT '验证时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_address` (`address`),
  INDEX `idx_verified_at` (`verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='声誉验证记录表';

-- 历史行为锚定表
CREATE TABLE IF NOT EXISTS `behavior_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `address` VARCHAR(42) NOT NULL COMMENT '地址',
  `history_hash` VARCHAR(80) NOT NULL COMMENT '历史哈希 (Poseidon(history_data))',
  `behavior_level` SMALLINT UNSIGNED NOT NULL COMMENT '行为等级 (0-100)',
  `leaf_index` INT UNSIGNED NOT NULL COMMENT 'Merkle 树叶子索引',
  `merkle_root` VARCHAR(80) NOT NULL COMMENT '锚定时的树根',
  `anchored_at` BIGINT UNSIGNED NOT NULL COMMENT '锚定时间戳',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_history_hash` (`history_hash`),
  INDEX `idx_address` (`address`),
  INDEX `idx_anchored_at` (`anchored_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史行为锚定表';

-- 历史行为 Merkle 树根表
CREATE TABLE IF NOT EXISTS `history_anchor_roots` (
  `root_hash` VARCHAR(80) NOT NULL COMMENT '树根哈希',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`root_hash`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史行为 Merkle 树根表';

-- ============================================================
-- 009_multisig_fixed.sql - 多签提案验证与 Governance
-- ============================================================

-- 多签 ZK 验证记录表
CREATE TABLE IF NOT EXISTS `multisig_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `proposal_id` VARCHAR(40) NOT NULL COMMENT '提案 ID',
  `auth_hash` VARCHAR(80) NOT NULL COMMENT '授权哈希 (Poseidon(total_weighted_votes, proposal_id, 1))',
  `threshold` VARCHAR(40) NOT NULL COMMENT '阈值',
  `verified_at` BIGINT UNSIGNED NOT NULL COMMENT '验证时间戳',
  PRIMARY KEY (`id`),
  INDEX `idx_proposal_id` (`proposal_id`),
  INDEX `idx_verified_at` (`verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多签 ZK 验证记录表';