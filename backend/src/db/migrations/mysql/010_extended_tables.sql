-- ============================================================
-- 010_extended_tables.sql - 成员活动、挑战记录、仲裁承诺、成员档案
-- ============================================================

-- 成员活动记录表（activityWatcher.service.js）
CREATE TABLE IF NOT EXISTS `member_activity` (
  `id` VARCHAR(120) NOT NULL COMMENT '活动 ID（事件去重键）',
  `address` VARCHAR(42) NOT NULL COMMENT '成员地址',
  `action` VARCHAR(50) NOT NULL COMMENT '动作类型 (CLAIM_SUBMIT/CLAIM_APPROVED/MEMBER_REGISTER/GOV_PROPOSE/GOV_VOTE/SIWE_LOGIN 等)',
  `tx_hash` VARCHAR(66) DEFAULT NULL COMMENT '链上交易哈希（平台内活动为 NULL）',
  `block_number` BIGINT UNSIGNED DEFAULT NULL COMMENT '区块号',
  `timestamp` BIGINT UNSIGNED NOT NULL COMMENT '时间戳',
  `detail` TEXT NOT NULL COMMENT '活动描述',
  PRIMARY KEY (`id`),
  INDEX `idx_address` (`address`),
  INDEX `idx_action` (`action`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成员活动记录表';

-- 成员档案表
CREATE TABLE IF NOT EXISTS `member_profiles` (
  `address` VARCHAR(42) NOT NULL COMMENT '成员地址（小写）',
  `sbt_id` VARCHAR(80) DEFAULT NULL COMMENT 'SBT Token ID',
  `credit_score` SMALLINT UNSIGNED NOT NULL DEFAULT 650 COMMENT '信用分数 (0-1000)',
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active' COMMENT '状态',
  `joined_at` BIGINT UNSIGNED NOT NULL COMMENT '加入时间戳',
  PRIMARY KEY (`address`),
  INDEX `idx_status` (`status`),
  INDEX `idx_joined_at` (`joined_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成员档案表';

-- 成员角色关联表
CREATE TABLE IF NOT EXISTS `member_roles` (
  `address` VARCHAR(42) NOT NULL COMMENT '成员地址',
  `role` VARCHAR(20) NOT NULL COMMENT '角色 (member/arbitrator/challenger/oracle/guardian/dao)',
  PRIMARY KEY (`address`, `role`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成员角色关联表';

-- 挑战记录表
CREATE TABLE IF NOT EXISTS `challenge_records` (
  `challenge_id` VARCHAR(40) NOT NULL COMMENT '挑战 ID',
  `proposal_id` VARCHAR(100) NOT NULL COMMENT '提案 ID',
  `reason_code` VARCHAR(100) NOT NULL COMMENT '原因代码',
  `evidence_snapshot` TEXT NOT NULL COMMENT '证据快照',
  `tx_hash` VARCHAR(66) NOT NULL COMMENT '质押交易哈希',
  `challenger` VARCHAR(42) NOT NULL COMMENT '挑战者地址',
  `stake_amount` DECIMAL(36, 18) NOT NULL COMMENT '质押金额',
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN' COMMENT '状态 (OPEN/RESOLVED/REJECTED)',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`challenge_id`),
  INDEX `idx_proposal_id` (`proposal_id`),
  INDEX `idx_challenger` (`challenger`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='挑战记录表';

-- 仲裁承诺与揭示表（commit-reveal 模式）
CREATE TABLE IF NOT EXISTS `arb_commits` (
  `proposal_id` VARCHAR(100) NOT NULL COMMENT '提案 ID',
  `arbitrator` VARCHAR(42) NOT NULL COMMENT '仲裁员地址',
  `commitment` VARCHAR(80) NOT NULL COMMENT '承诺哈希 (keccak256(choice, salt))',
  `choice` TINYINT UNSIGNED DEFAULT NULL COMMENT '揭示后的选择 (NULL=未揭示)',
  `salt_masked` VARCHAR(20) DEFAULT NULL COMMENT '揭示后的盐值（脱敏）',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '承诺时间戳',
  `revealed_at` BIGINT UNSIGNED DEFAULT NULL COMMENT '揭示时间戳',
  PRIMARY KEY (`proposal_id`, `arbitrator`),
  INDEX `idx_arbitrator` (`arbitrator`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='仲裁承诺与揭示表';

-- 仲裁任务分配表
CREATE TABLE IF NOT EXISTS `arb_tasks` (
  `task_id` VARCHAR(40) NOT NULL COMMENT '任务 ID',
  `proposal_id` VARCHAR(100) NOT NULL COMMENT '提案 ID',
  `selected_arbitrators` JSON DEFAULT NULL COMMENT '选中仲裁员列表',
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT '状态 (OPEN/IN_PROGRESS/RESOLVED)',
  `created_at` BIGINT UNSIGNED NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`task_id`),
  INDEX `idx_proposal_id` (`proposal_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='仲裁任务分配表';
