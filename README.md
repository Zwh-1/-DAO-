# TrustAid Platform (MVP)

基于零知识证明与 DAO 治理的去中心化互助平台最小可运行骨架。

## 📦 快速开始

### 方式 A：Docker Compose（推荐）

```bash
cd trustaid-platform
docker compose up -d
# 前端：http://localhost:3000
# 后端：http://localhost:3010
# IPFS Gateway：http://localhost:8080
```

### 方式 B：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 编译所有（合约 + 电路）
npm run compile:all

# 3. 运行所有测试
npm run test:all

# 4. 启动开发环境
npm run dev:all
```

## 🚀 NPM 指令总览

### 安全检查
- `npm run scan` - 安全扫描（检测代码漏洞）
- `npm run phase9:scan` - 阶段 9 安全扫描

### 测试
- `npm run test:api` - API 集成测试
- `npm run test:contracts` - 合约测试（Hardhat）
- `npm run test:circuits` - 电路测试
- `npm run test:circuits:full` - 完整电路测试
- `npm run test:all` - 所有测试（合约 + 电路）

### 开发
- `npm run dev:backend` - 后端开发模式
- `npm run dev:frontend` - 前端开发模式
- `npm run dev:all` - 同时启动前后端

### 编译
- `npm run compile` - 编译合约
- `npm run compile:circuits` - 编译电路
- `npm run compile:identity` - 编译身份承诺电路
- `npm run compile:antisybil` - 编译抗女巫电路
- `npm run compile:all` - 编译所有

### 部署
- `npm run deploy` - 部署合约
- `npm run deploy:local` - 部署到本地网络
- `npm run deploy:testnet` - 部署到测试网

### 零知识证明
- `npm run zk:setup` - 可信设置（生成 zkey）
- `npm run zk:prove` - 生成零知识证明
- `npm run zk:verify` - 验证证明
- `npm run zk:full` - 完整流程（setup → prove → verify）

### 工具
- `npm run clean` - 清理所有构建产物
- `npm run clean:circuits` - 清理电路层
- `npm run clean:contracts` - 清理合约层
- `npm run info:circuits` - 显示电路信息（约束数、状态等）
- `npm run docs` - 生成 HTML 文档

## 📋 当前已实现

- ✅ `backend`：理赔提案 API、Nullifier 抗重放校验、基础 AI 安全审计接口
- ✅ `frontend`：Next.js 页面骨架、无蓝紫配色、隐私盾牌脉冲动效、安全提示
- ✅ `contracts`：Solidity 防重放理赔入口示例
- ✅ `circuits`：Circom 2.1 Poseidon + LessThan 约束示例

## 第二阶段新增

- `claim/propose -> ClaimVault` 可选链上转发（`ethers`）
- `backend/db/migrations/001_init.sql`：Nullifier 唯一索引
- 角色 API（Member / Arbitrator / Challenger / Oracle）：
  - `GET /v1/member/profile/:address`
  - `POST /v1/member/wallets/bind`
  - `GET /v1/arb/tasks/my?address=...`
  - `POST /v1/arb/commit`
  - `POST /v1/arb/reveal`
  - `POST /v1/challenge/init`
  - `POST /v1/oracle/report`
- `POST /v1/oracle/legacy-report`（兼容旧版，已废弃）

## 第三阶段新增

- 前端 API 客户端：`frontend/lib/api.ts`
- 角色页面最小原型：
  - `frontend/app/claim/page.tsx`（理赔提交 + 状态查询）
  - `frontend/app/member/page.tsx`（成员画像 + 钱包绑定）
  - `frontend/app/arbitrator/page.tsx`（Commit + Reveal）
  - `frontend/app/challenger/page.tsx`（挑战发起）
- 统一导航组件：`frontend/app/components/RoleNav.tsx`

## 第四阶段新增

- 表单字段顺序对齐文档规范（并标注扩展字段）
- 前端校验规则统一化：
  - 空值校验
  - `bytes32` 校验（`nullifierHash`）
  - 地址格式校验（EVM `0x` 40 字节）
  - 交易哈希格式校验（`0x` 64 字节）
  - 最小质押校验（`stakeAmount >= 100`）
- 错误码中文映射：
  - `frontend/lib/error-map.ts`
  - 典型映射：`2002/3001/4001`

## 安全基线

- Witness 数据不上传、不记录明文
- Nullifier 一次性使用
- 禁止 MD5 / SHA-1
- UI 禁用蓝紫渐变

## 阶段五（电路，`circuits/`）

- `src/identity_commitment.circom`：Poseidon(social_id_hash, secret, trapdoor) → identity_commitment
- `src/anti_sybil_verifier.circom`：Merkle 成员资格 + Nullifier + 等级/金额/时间窗口约束（深度 8）
- `src/utils/poseidon_hasher.circom`、`merkle_tree.circom`
- `npm test` 默认跳过重编译（Windows/路径问题可设 `RUN_CIRCOM_TESTS=1` 或 WSL）；`npm run test:circom` 强制启用
- `params/pot12_final.ptau` 与 `snarkjs` 流水线见 `circuits/README.md`

## 阶段六（合约，`contracts/`）

- `MockGroth16Verifier` / `IGroth16Verifier`：测试网占位，生产换 `snarkjs zkey export solidityverifier`
- `IdentityRegistry`：承诺注册 / 黑名单 / 等级
- `ClaimVaultZK`：`verifyProof` + Nullifier 映射 + **链上金额二次校验**（`min/max`）
- `ArbitratorPool`：质押注册 + `block.prevrandao` 伪随机抽选（生产可换 Chainlink VRF）
- `ChallengeManager`：挑战质押 + Commit/Reveal 骨架
- `npx hardhat test`：`ClaimVaultZK` + `Governance` 用例

## 阶段七（前端）

- `hooks/useZkEngine.ts` + `public/workers/zkWorker.js`：Worker 内证明（MVP 为 mock，可接 `.wasm/.zkey`）
- `hooks/useSIWE.ts`、`store/authStore.ts`、`store/zkStore.ts`
- `components/zk/PrivacyShield.tsx`、 `ProofProgress.tsx`、 `ProofResult.tsx`
- 理赔页集成 SIWE + Worker + 文档配色变量（含 `--color-danger: #C0392B`）

## 阶段八（后端）

- `GET /v1/auth/nonce`、`POST /v1/auth/verify`（EIP-4361 风格 SIWE + JWT）
- `requireAuth`/`requireAdmin`、挑战接口简易限流、`zkVerify`/`aiAudit`/`riskEngine` 服务
- `DATABASE_URL` 存在时：`nullifier_registry` / `claim_records` 双写（失败则忽略，内存仍为兜底）
- 迁移：`db/migrations/002_indexes.sql`、`003_blacklist.sql`
- 环境变量见 `backend/.env.example`（`JWT_SECRET`、`ADMIN_TOKEN`、`BYPASS_AUTH`）

## 阶段九（工程化）

- `npm run phase9:scan`（仓库根 `trustaid-platform/package.json`）：静态扫描典型不安全哈希调用
- `scripts/loadtest/k6-stub.js`：k6 压测占位

## 补全阶段（本轮新增）

### 合约层

| 合约 | 功能 |
|------|------|
| `SBT.sol` | ERC-5192 灵魂绑定代币；不可转让、等待期保护、黑名单 |
| `OracleManager.sol` | 多签预言机报告；MIN_QUORUM=3，FASTTRACK_QUORUM=5，极速通道绕过等待期 |
| `ChallengeManager.sol` | 完整奖惩结算：挑战成立退还质押，失败则质押进仲裁员奖励池 |
| `Governance.sol` | 加权投票 + 2 天时间锁；提案 → 投票 → 排队 → 执行完整流程 |
| `test/SBTAndGovernance.t.js` | 覆盖 SBT 铸造/锁定/黑名单、Oracle 多签终结、Governance 投票+时间锁执行 |

### 前端层

| 页面/组件 | 路径 | 功能 |
|-----------|------|------|
| 预言机工作台 | `/oracle` | 提交报告、追加签名、查询状态 |
| 守护者工作台 | `/guardian` | 熔断器（暂停/恢复）、黑名单管理 |
| DAO 治理看板 | `/dao` | 提案列表、发起提案、参与投票 |
| AI 智能客服 | 全局浮动按钮 | 快捷问答 + DeepSeek/OpenAI 降级静态知识库；内置安全提示 |

### 后端层

| 接口组 | 端点 |
|--------|------|
| Oracle | `POST /v1/oracle/report`、`POST /v1/oracle/sign`、`GET /v1/oracle/report/:id`、`POST /v1/oracle/legacy-report`（deprecated） |
| Guardian | `GET /v1/guardian/status`、`POST /v1/guardian/circuit`、`POST /v1/guardian/blacklist`、`GET /v1/guardian/audit-log` |
| Governance | `GET /v1/governance/proposals`、`POST /v1/governance/propose`、`POST /v1/governance/vote` |
| AI Chat | `POST /v1/ai/chat`（DeepSeek → OpenAI → 静态知识库三级降级） |

### 基础设施

- `docker-compose.yml`：一键启动 PostgreSQL 16 + IPFS Kubo + 后端 + 前端
- `backend/db/migrations/004_governance.sql`：治理提案 / 投票 / 守护者审计日志 / 黑名单 / Oracle 报告表
- `backend/Dockerfile`、`frontend/Dockerfile`：容器化部署支持

## 📚 详细文档

- **[circuits/README.md](./circuits/README.md)** - 电路层完整文档（编译、可信设置、证明生成）
- **[contracts/README.md](./contracts/README.md)** - 合约层文档（部署、测试、交互）
- **[backend/README.md](./backend/README.md)** - 后端 API 文档
- **[frontend/README.md](./frontend/README.md)** - 前端开发文档

## 🛡️ 安全基线

- ✅ Witness 数据不上传、不记录明文
- ✅ Nullifier 一次性使用（抗重放）
- ✅ 禁止 MD5 / SHA-1（电路内使用 Poseidon，链上使用 Keccak256）
- ✅ UI 禁用蓝紫渐变（专业医疗配色）
- ✅ 日志脱敏（不泄露健康数据、用户 ID）

## 📊 性能指标

| 电路 | 约束数量 | 证明生成 | 链上验证 Gas |
|------|----------|----------|--------------|
| identity_commitment | 605 | < 1 秒 | ~50K |
| anti_sybil_verifier | ~2500 | 2-5 秒 | ~150K-300K |

## 📝 API 示例

`POST /v1/claim/propose`

```json
{
  "claimId": "CL-20260403-001",
  "nullifierHash": "0x8ef4...",
  "proof": { "protocol": "groth16" },
  "publicSignals": ["1", "10000", "12345"],
  "evidenceCid": "ipfs://Qm...",
  "address": "0xabc..."
}
```

`POST /v1/ai/chat`

```json
{ "message": "什么是 Nullifier？" }
```

`POST /v1/governance/vote`（需 JWT）

```json
{ "proposalId": 1, "support": 1 }
```

## 🔧 常用工作流

### 零知识证明完整流程

```bash
# 1. 编译身份承诺电路
npm run compile:identity

# 2. 可信设置（首次运行需要下载 PTAU 文件，约 1.8GB）
npm run zk:setup

# 3. 生成证明（本地生成，私有数据不离端）
npm run zk:prove

# 4. 验证证明（本地验证，不消耗 Gas）
npm run zk:verify

# 或直接使用一键命令
npm run zk:full
```

### 部署到测试网

```bash
# 1. 编译合约和电路
npm run compile:all

# 2. 运行所有测试确保无问题
npm run test:all

# 3. 部署到测试网（如 Goerli、Sepolia）
npm run deploy:testnet
```

### 清理和重建

```bash
# 1. 清理所有构建产物
npm run clean

# 2. 重新编译
npm run compile:all

# 3. 查看电路信息（约束数、状态等）
npm run info:circuits
```

## 🎯 下一步计划

- [ ] 完成抗女巫电路的完整约束（Merkle 树深度=8）
- [ ] 集成 Chainlink VRF 用于随机抽选仲裁员
- [ ] 实现前端 WebWorker 证明生成
- [ ] 添加更多单元测试和集成测试
- [ ] 完善 AI 安全审计功能
- [ ] 生产环境多重签名部署

## 📖 参考资料

- [Circom 官方文档](https://docs.circom.io/)
- [SnarkJS GitHub](https://github.com/iden3/snarkjs)
- [Hardhat 文档](https://hardhat.org/docs)
- [Next.js 文档](https://nextjs.org/docs)
- [零知识证明入门](https://zkproof.org/)

## 📝 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2026-04-05  
**版本**: 0.1.0
