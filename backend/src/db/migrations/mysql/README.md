# MySQL 数据库迁移指南

## 📋 概述

本项目已将 PostgreSQL 数据库迁移至 MySQL，所有迁移文件已转换为符合 MySQL 规范的 SQL 脚本。

---

## 🎯 迁移文件清单

| 序号 | 文件名 | 功能描述 | 表数量 |
|------|--------|----------|--------|
| 001 | `001_init.sql` | 基础表结构（申领记录、Nullifier、钱包绑定） | 3 |
| 002 | `002_indexes.sql` | 额外索引与 Identity 表 | 1 |
| 003 | `003_blacklist.sql` | 黑名单与审计日志 | 2 |
| 004 | `004_governance.sql` | DAO 治理/守护者/预言机 | 5 |
| 005 | `005_identity.sql` | 身份承诺、SBT 代币、白名单 Merkle 树 | 3 |
| 006 | `006_anonymous_claim.sql` | 匿名申领记录 | 1 |
| 007 | `007_channels.sql` | 支付通道与保密转账 | 3 |
| 008 | `008_reputation.sql` | 声誉系统与历史行为锚定 | 3 |
| 009 | `009_multisig.sql` | 多签提案验证 | 1 |

**总计**: 9 个迁移文件，22 张数据表

---

## 🔧 数据库配置

### 1. 安装 MySQL

**Windows 环境**:
```bash
# 下载 MySQL Community Server
https://dev.mysql.com/downloads/mysql/

# 或使用 Chocolatey
choco install mysql
```

### 2. 创建数据库

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `trustaid_dev` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选，生产环境推荐）
CREATE USER IF NOT EXISTS 'trustaid'@'localhost' 
  IDENTIFIED BY 'your_secure_password';

-- 授权
GRANT ALL PRIVILEGES ON `trustaid_dev`.* TO 'trustaid'@'localhost';
FLUSH PRIVILEGES;

-- 验证
SHOW DATABASES;
USE trustaid_dev;
SHOW TABLES;
```

### 3. 运行迁移

**方式一：命令行批量执行**
```bash
cd d:\Desktop\projects\trustaid-platform\backend\src\db\migrations\mysql

# Windows PowerShell
Get-ChildItem -Filter "*.sql" | Sort-Object Name | ForEach-Object {
  Write-Host "Executing $($_.Name)..."
  mysql -u root -p trustaid_dev < $_.FullName
}

# 或手动逐个执行
mysql -u root -p trustaid_dev < 001_init.sql
mysql -u root -p trustaid_dev < 002_indexes.sql
mysql -u root -p trustaid_dev < 003_blacklist.sql
# ... 依次执行
```

**方式二：MySQL Workbench**
1. 打开 MySQL Workbench
2. 连接到数据库
3. `File` → `Open SQL Script`
4. 按顺序打开并执行迁移文件

**方式三：使用迁移工具（推荐）**
```bash
# 安装 db-migrate (Node.js)
npm install -g db-migrate mysql

# 或使用 golang-migrate
go install -tags 'mysql' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

---

## 📊 数据库表结构

### 核心业务表

#### 1. `claim_records` - 申领记录表
```sql
CREATE TABLE `claim_records` (
  `claim_id` VARCHAR(100) PRIMARY KEY,
  `nullifier_hash` VARCHAR(66) UNIQUE NOT NULL,
  `evidence_cid` VARCHAR(100) NOT NULL,
  `claimant_address` VARCHAR(42) NOT NULL,
  `amount` VARCHAR(40) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'PENDING_REVIEW',
  `created_at` BIGINT NOT NULL
);
```

**用途**: 存储所有申领记录，支持 ZK 匿名申领

#### 2. `nullifier_registry` - Nullifier 注册表
```sql
CREATE TABLE `nullifier_registry` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nullifier_hash` VARCHAR(66) UNIQUE NOT NULL,
  `created_at` BIGINT NOT NULL
);
```

**用途**: 防重放攻击，确保每个 Nullifier 只能使用一次

#### 3. `identity_commitments` - 身份承诺注册表
```sql
CREATE TABLE `identity_commitments` (
  `commitment` VARCHAR(80) PRIMARY KEY,
  `level` SMALLINT UNSIGNED DEFAULT 1,
  `banned` TINYINT(1) DEFAULT 0,
  `expiry_time` BIGINT UNSIGNED DEFAULT 0,
  `tx_hash` VARCHAR(66),
  `registered_at` BIGINT UNSIGNED NOT NULL
);
```

**用途**: 存储用户身份承诺（Poseidon 哈希），支持等级和封禁管理

#### 4. `sbt_tokens` - SBT 代币表
```sql
CREATE TABLE `sbt_tokens` (
  `token_id` VARCHAR(80) PRIMARY KEY,
  `holder_address` VARCHAR(42) UNIQUE NOT NULL,
  `commitment` VARCHAR(80) NOT NULL,
  `level` SMALLINT UNSIGNED DEFAULT 1,
  `credit_score` SMALLINT UNSIGNED DEFAULT 650,
  `joined_at` BIGINT UNSIGNED NOT NULL,
  `tx_hash` VARCHAR(66)
);
```

**用途**: 不可转移代币（SBT），代表用户身份和声誉

---

## 🔑 关键设计变更

### PostgreSQL → MySQL 差异处理

| 特性 | PostgreSQL | MySQL | 处理方式 |
|------|-----------|-------|----------|
| 自增主键 | `BIGSERIAL` | `BIGINT UNSIGNED AUTO_INCREMENT` | 已转换 |
| 布尔类型 | `BOOLEAN` | `TINYINT(1)` | 已转换 |
| JSON 类型 | `JSONB` | `JSON` | 已转换 |
| 时间戳函数 | `EXTRACT(EPOCH FROM NOW())` | 应用层生成 | 已移除 |
| 数组类型 | `TEXT[]` | `JSON` | 已转换 |
| 外键级联 | 相同 | 相同 | 保留 |

### 字段类型映射

```sql
-- PostgreSQL
commitment      TEXT
level           SMALLINT
banned          BOOLEAN
payload         JSONB
signers         TEXT[]

-- MySQL
commitment      VARCHAR(80)
level           SMALLINT UNSIGNED
banned          TINYINT(1)
payload         JSON
signers         JSON
```

---

## 🔐 安全配置

### 1. 连接字符串

**开发环境**:
```env
DATABASE_URL=mysql://trustaid:your_password@localhost:3306/trustaid_dev
```

**生产环境**:
```env
DATABASE_URL=mysql://trustaid:secure_password@db-host:3306/trustaid_prod
```

### 2. 用户权限最小化

```sql
-- 只授予必要的权限
GRANT SELECT, INSERT, UPDATE, DELETE ON `trustaid_dev`.* TO 'trustaid'@'localhost';
-- 不要授予 DROP, ALTER 等 DDL 权限
```

### 3. 启用审计日志

```sql
-- 在 my.cnf 中配置
[mysqld]
general_log = 1
general_log_file = /var/log/mysql/general.log
```

---

## 📈 索引优化

### 已创建的索引

| 表名 | 索引名 | 字段 | 类型 |
|------|--------|------|------|
| `claim_records` | `uk_nullifier_hash` | `nullifier_hash` | 唯一 |
| `claim_records` | `idx_claimant` | `claimant_address` | 普通 |
| `identity_commitments` | `idx_level` | `level` | 普通 |
| `identity_commitments` | `idx_banned` | `banned` | 普通 |
| `sbt_tokens` | `uk_holder_address` | `holder_address` | 唯一 |
| `sbt_tokens` | `idx_credit_score` | `credit_score` | 普通 |
| `gov_proposals` | `idx_state` | `state` | 普通 |

### 索引原则

- ✅ 主键使用 `BIGINT UNSIGNED AUTO_INCREMENT`
- ✅ 外键字段添加索引
- ✅ 唯一业务字段添加唯一索引
- ✅ 查询频繁字段添加普通索引
- ✅ 单表索引不超过 5 个

---

## 🧪 测试验证

### 1. 检查表结构

```sql
USE trustaid_dev;

-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE claim_records;
DESCRIBE identity_commitments;
DESCRIBE sbt_tokens;

-- 查看索引
SHOW INDEX FROM claim_records;
```

### 2. 插入测试数据

```sql
-- 测试身份承诺
INSERT INTO identity_commitments (commitment, level, banned, registered_at)
VALUES ('0x1234567890abcdef', 1, 0, UNIX_TIMESTAMP());

-- 测试 SBT 代币
INSERT INTO sbt_tokens (token_id, holder_address, commitment, level, credit_score, joined_at)
VALUES ('token_001', '0xAb58014CD497Cc7356950a960d707C38C8A77f58', '0x1234567890abcdef', 1, 650, UNIX_TIMESTAMP());

-- 验证
SELECT * FROM identity_commitments;
SELECT * FROM sbt_tokens;
```

### 3. 测试外键约束

```sql
-- 应该成功（commitment 存在）
INSERT INTO whitelist_merkle_leaves (commitment, user_level, merkle_leaf, leaf_index, merkle_root, created_at)
VALUES ('0x1234567890abcdef', 1, '0xabcdef', 0, '0xroot123', UNIX_TIMESTAMP());

-- 应该失败（commitment 不存在，外键约束）
INSERT INTO whitelist_merkle_leaves (commitment, user_level, merkle_leaf, leaf_index, merkle_root, created_at)
VALUES ('0xinvalid', 1, '0xabcdef', 0, '0xroot123', UNIX_TIMESTAMP());
```

---

## 🔄 数据迁移（从 PostgreSQL）

如果需要从现有 PostgreSQL 数据库迁移数据：

### 1. 导出数据

```bash
# PostgreSQL 导出
pg_dump -U postgres -d trustaid_dev --data-only --column-inserts > pg_data.sql
```

### 2. 转换数据格式

```bash
# 使用脚本转换 PostgreSQL 语法为 MySQL
python convert_pg_to_mysql.py pg_data.sql mysql_data.sql
```

### 3. 导入数据

```bash
mysql -u root -p trustaid_dev < mysql_data.sql
```

---

## 🛠️ 常见问题

### Q1: 时区问题

**问题**: MySQL 默认使用服务器时区

**解决**:
```sql
-- 设置会话时区
SET time_zone = '+08:00';

-- 或在连接字符串中指定
DATABASE_URL=mysql://user:pass@localhost:3306/db?time_zone=%2B08%3A00
```

### Q2: 大小写敏感

**问题**: MySQL 表名在 Windows 不区分大小写，在 Linux 区分

**解决**:
```ini
# my.cnf
[mysqld]
lower_case_table_names=1  # Windows: 1, Linux: 0
```

### Q3: JSON 字段查询

```sql
-- MySQL 8.0+ JSON 查询
SELECT * FROM oracle_reports 
WHERE JSON_CONTAINS(signers, '"0x1234567890abcdef"');

-- 提取 JSON 值
SELECT report_id, JSON_EXTRACT(payload, '$.claimId') AS claim_id
FROM audit_logs;
```

### Q4: 时间戳处理

```sql
-- MySQL 不推荐使用 TIMESTAMP，改用 BIGINT
-- 应用层生成时间戳
const timestamp = Math.floor(Date.now() / 1000);

-- 或使用 MySQL 函数
INSERT INTO table (created_at) VALUES (UNIX_TIMESTAMP());
```

---

## 📝 下一步

1. **配置后端连接**
   - 更新 `backend/.env` 中的 `DATABASE_URL`
   - 测试数据库连接

2. **运行迁移**
   - 按顺序执行所有迁移文件
   - 验证表结构

3. **测试功能**
   - 运行后端单元测试
   - 测试数据库 CRUD 操作

4. **性能优化**
   - 分析慢查询日志
   - 添加必要的索引
   - 配置查询缓存

---

## 🎯 检查清单

- [x] 所有 PostgreSQL 语法已转换为 MySQL
- [x] 字段类型符合 MySQL 规范
- [x] 索引命名符合规范（`idx_`, `uk_`）
- [x] 外键约束已正确配置
- [x] JSON 字段已转换
- [x] 布尔类型已转换为 `TINYINT(1)`
- [x] 字符集设置为 `utf8mb4`
- [x] 存储引擎为 `InnoDB`
- [x] 所有字段都有中文注释
- [x] 所有表都有中文注释

---

**创建日期**: 2026-04-15  
**数据库版本**: MySQL 8.0+  
**字符集**: utf8mb4  
**引擎**: InnoDB
