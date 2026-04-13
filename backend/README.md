# Backend Phase 2

## 新增能力

- Nullifier 防重放持久化模型（含 PostgreSQL 唯一索引脚本）
- 角色 API：`member`、`arb`、`oracle`、`challenge`
- 链上转发：`claim/propose` 可选调用 `ClaimVault.proposeClaim`

## 配置

复制 `.env.example` 为 `.env` 并按需填写。

## 数据库迁移（可选）

将 `db/migrations/001_init.sql` 执行到 PostgreSQL：

```sql
\i db/migrations/001_init.sql
```

> 当前示例服务默认使用内存存储；若你接入 PostgreSQL，可直接复用该唯一索引模型。
