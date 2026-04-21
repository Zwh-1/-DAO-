# Backend Phase 2

## 新增能力

- Nullifier 防重放持久化模型（MySQL 迁移见 `src/db/migrations/mysql/`；历史 PostgreSQL 脚本仍在 `db/migrations/` 供参考）
- 角色 API：`member`、`arb`、`oracle`、`challenge`
- 链上转发：`claim/propose` 可选调用 `ClaimVault.proposeClaim`

## 配置

复制 `.env.example` 为 `.env` 并按需填写。

- **ZK 匿名申领（主路径）**：环境变量表与行为说明见仓库根目录 **`docs/ZK申领端到端.md`**。要点：
  - `RPC_URL` + `ANONYMOUS_CLAIM_ADDRESS`：即可链上只读 `GET /v1/anonymous-claim/status` 等（无需中继私钥）。
  - `RELAYER_PRIVATE_KEY`：配置后代播 `AnonymousClaim.claim`；不配则为 **offchain** 记录 nullifier、不广播。
  - `DATABASE_URL`：可选；不配时相关双写仍可用内存兜底。连接池为 **mysql2**（`src/db/pool.js`），与根目录 Docker Compose 中的 Postgres 服务不是同一套连接，本地请按 `.env.example` 填 MySQL 或留空。
- **AI**：`DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 用于智能客服与 `POST /v1/ai/claim-audit` 的 **LLM 语义审计**；未配置时客服与审计均降级为规则/静态。可选 `AI_AUDIT_MODEL` 覆盖审计模型名。
- **生产闸门**：见 `docs/安全/生产闸门.md`。要点：`ALLOW_BYPASS_BODY_AUTH`、`ALLOW_INSECURE_ADMIN`、`ALLOW_SERVER_NULLIFIER_DERIVE`。

启动：`npm run dev`（读取 `--env-file=.env`）；启动日志会打印 `anonymous_claim` 链上只读 / 中继是否就绪。

## 数据库迁移（可选）

MySQL：见 `src/db/migrations/mysql/README.md` 与 `setup-database.ps1`。

历史 PostgreSQL 初始化示例（若仍用 PG 侧车，需自行与当前 mysql2 池适配或仅作参考）：

```sql
\i db/migrations/001_init.sql
```
