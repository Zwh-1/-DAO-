# ZK 匿名申领端到端（主路径：anonymous_claim）

本文描述 **身份承诺 → Merkle → 本地 Groth16 证明 → nullifier 防重 → 后端/链上结算** 的黄金路径，以及与 `claim/propose` + `anti_sybil_verifier` 扩展路径的关系。

**开发与排障（页面组件、数据流、环境变量、测试清单）**：见 [匿名申领-开发手册.md](./匿名申领-开发手册.md)。

## 主路径与扩展路径

| 路径 | 电路 | API | 说明 |
|------|------|-----|------|
| **主路径（推荐）** | `anonymous_claim.circom` | `POST /v1/anonymous-claim/claim` | 7 个 public signals，对应 `AnonymousClaim.sol` |
| 扩展路径 | `anti_sybil_verifier.circom` 等 | `POST /v1/claim/propose` | 已登录、更强业务字段；见 `claim.routes.js` / `onchain.js` |

产品叙事上默认 **anonymous_claim** 为匿名空投主路径；`claim/propose` 单独维护 publicSignals 与部署地址，避免双轨混用。

### 扩展路径与 ClaimVaultZK（8 个 public）

- `anti_sybil_verifier.circom` 当前 **8** 个 public：`merkle_root`, `identity_commitment`, `nullifier_hash`, `user_level`, `claim_amount`, `claim_ts`, `parameter_hash`, `merkle_leaf`（与 `circuits/src/anti_sybil_verifier.circom` 一致）。
- `ClaimVaultZK` 构造函数需传入链上绑定的 `expectedMerkleRoot`、`expectedParameterHash`、`airdropProjectId`（与电路私有参数经 Poseidon 聚合的 `parameter_hash` 及 EIP-712 中 `projectId` 对齐）。
- 链上中继启用时，`POST /v1/claim/propose` 须额外携带 **`claimSignature`**：`0x` + 65 字节，为申领者对 EIP-712 `Claim(nullifier, identityCommitment, projectId)` 的签名（与 `ClaimVaultZK` 一致）；`onchain.js` 将 `publicSignals`（长度 8）与该签名一并提交 `claimAirdrop`。

## Public signals 顺序（必须与合约一致）

与 `contracts/contracts/anonymous/AnonymousClaim.sol` 中 `claim(..., uint[7] pubSignals)` 一致：

| 索引 | 含义 |
|------|------|
| 0 | `merkle_root` |
| 1 | `nullifier` |
| 2 | `commitment` |
| 3 | `claim_amount` |
| 4 | `current_timestamp` |
| 5 | `ts_start` |
| 6 | `ts_end` |

电路定义见 `circuits/src/anonymous_claim.circom` 的 `component main { public [...] }`。

## 密码学约定（与电路一致）

- **Nullifier** = Poseidon(secret, airdrop_id)  
- **Commitment** = Poseidon(secret, nullifier)  
- **Merkle 叶子** = commitment（深度 20，Poseidon 二叉树）

链下服务端树实现见 `backend/src/services/merkleTree.service.js` 中「匿名申领树」；须与部署时 `AnonymousClaim` 的 `merkleRoot` 对齐，否则链上 `MerkleRootMismatch`。

## 后端 API

- `GET /v1/anonymous-claim/status`：合约余额、统计、`merkleRoot`、`tsStart`、`tsEnd`，以及链下 `offchainMerkleRoot`（若可用）。  
- `GET /v1/anonymous-claim/merkle-root`：当前链下匿名申领树根。  
- `POST /v1/anonymous-claim/register-commitment`：注册 commitment 叶子（限流；生产需配合鉴权/运营流程）。  
- `POST /v1/anonymous-claim/merkle-proof`：请求体 `{ commitment }`，返回 `leafIndex`、`pathElements`（长度 20）、`merkleRoot` 等。  
- `POST /v1/anonymous-claim/claim`：请求体 `{ recipient, amount, nullifier, proof, pubSignals }`；`proof` 支持 snarkjs 的 `pi_a` / `pi_b` / `pi_c`（后端会规范为 `pA/pB/pC` 再调合约）。  
- `GET /v1/anonymous-claim/nullifier/:hash`：查询 nullifier 是否已使用。

## 前端

- 证明 Hook：`frontend/hooks/useAnonymousClaimProof.ts`  
- Witness 与输入序列化：`frontend/lib/zk/anonymousClaimWitness.ts`  
- API：`frontend/lib/api/anonymousClaim.ts`  
- 默认 wasm/zkey 路径由 `NEXT_PUBLIC_ANONYMOUS_CLAIM_*` 指定（默认指向 `public/circuits/build/` 下文件名）。

## 环境变量清单（后端）

| 变量 | 用途 |
|------|------|
| `RPC_URL` | 链 RPC（与 `config.js` 中字段名一致即可） |
| `RELAYER_PRIVATE_KEY` | 中继钱包私钥 |
| `ANONYMOUS_CLAIM_ADDRESS` | `AnonymousClaim` 合约地址 |

未配置中继时，后端以 **offchain** 模式记录 nullifier，不广播交易（见 `anonymousClaim.service.js`）。

## 构建产物

电路编译、zkey 与复制到 `public` 的步骤见 `circuits/README.md`。

## AI / 客服提示

AI 助手不会、也不应询问用户的私钥、secret 或助记词；申领故障排查仅涉及公开参数与 Merkle 流程。
