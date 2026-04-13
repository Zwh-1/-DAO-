# 📋 电路编译与部署完整执行计划

**创建时间**: 2026-04-11  
**执行状态**: 进行中 - 第二阶段（Trusted Setup）  
**修复重点**: 合约层与电路层接口对齐

---

## 🎯 执行目标

1. ✅ **第一阶段**: 完成所有电路编译
2. ⏳ **第二阶段**: 完成所有电路 Trusted Setup
3. 📋 **第三阶段**: 修复合约层接口不一致问题
4. 📋 **第四阶段**: 重新编译受影响的电路
5. 📋 **第五阶段**: 重新执行受影响的 Trusted Setup
6. 📋 **第六阶段**: 部署合约
7. 📋 **第七阶段**: 运行测试验证

---

## ✅ 第一阶段：电路编译（已完成）

**执行时间**: 已完成  
**状态**: ✅ 100% 完成

### 编译结果

| # | 电路名称 | R1CS 大小 | 约束数量 | 状态 |
|---|---------|----------|---------|------|
| 1 | `identity_commitment` | 122 KB | ~1,000 | ✅ |
| 2 | `anti_sybil_verifier` | 1,679 KB | 12,703 | ✅ |
| 3 | `history_anchor` | 1,414 KB | 10,837 | ✅ |
| 4 | `confidential_transfer` | 222 KB | ~2,000 | ✅ |
| 5 | `multi_sig_proposal` | 367 KB | ~4,000 | ✅ |
| 6 | `privacy_payment` | 211 KB | ~2,000 | ✅ |
| 7 | `private_payment` | 2,839 KB | 21,651 | ✅ |
| 8 | `reputation_verifier` | 74 KB | ~800 | ✅ |

**执行命令**:
```bash
cd D:\Desktop\projects\trustaid-platform\circuits
npm run compile:all
```

---

## ⏳ 第二阶段：批量 Trusted Setup（进行中）

**执行时间**: 2026-04-11 开始  
**状态**: ⏳ 进行中 - 处理第 1 个电路

### 当前进度

**正在处理**: `identity_commitment` (1/8)  
**当前步骤**: Groth16 Setup（预计 5-15 分钟）

**执行命令**:
```bash
node scripts/zk-setup-all-fast.mjs
```

### 完整电路列表

| # | 电路名称 | 预计耗时 | 状态 | 备注 |
|---|---------|---------|------|------|
| 1 | `identity_commitment` | 10 分钟 | ⏳ 进行中 | 基础身份电路 |
| 2 | `anti_sybil_verifier` | 15 分钟 | 📋 等待中 | ⚠️ 需重新执行（接口已修改） |
| 3 | `history_anchor` | 12 分钟 | 📋 等待中 | |
| 4 | `confidential_transfer` | 8 分钟 | 📋 等待中 | |
| 5 | `multi_sig_proposal` | 10 分钟 | 📋 等待中 | |
| 6 | `privacy_payment` | 8 分钟 | 📋 等待中 | |
| 7 | `private_payment` | 20 分钟 | 📋 等待中 | 约束最多 |
| 8 | `reputation_verifier` | 6 分钟 | 📋 等待中 | 约束最少 |

**总预计耗时**: 80-90 分钟

### 生成文件

每个电路将生成：
- `*_final.zkey` (~50MB) - 证明密钥
- `vkey.json` (~1KB) - 验证密钥
- `Groth16Verifier.sol` - Solidity 验证器合约

---

## 📋 第三阶段：合约层修复（已完成）

**执行时间**: 2026-04-11  
**状态**: ✅ 已完成

### 修复内容

#### 1. 电路层修改

**文件**: `circuits/src/anti_sybil_verifier.circom`

**修改**:
- ✅ 添加 `identity_commitment` (公开输出 [1])
- ✅ 添加 `user_level` (公开输出 [4])
- ✅ 添加 `ts_start` (公开输出 [9])
- ✅ 添加 `ts_end` (公开输出 [10])
- ✅ 添加 `airdrop_project_id` (公开输出 [11])
- ✅ 添加 `merkle_leaf` (公开输出 [12])

**Public 输出总数**: 9 → 13

#### 2. 合约层修改

**文件**: `contracts/core/ClaimVaultZK.sol`

**修改**:
- ✅ Public Signals 长度检查：`>= 11` → `== 13`
- ✅ Nullifier 类型：`bytes32` → `uint256`
- ✅ 添加时间窗口验证：`claimTs ∈ [tsStart, tsEnd]`
- ✅ 添加项目 ID 验证（可选）
- ✅ 修复变量引用：`commitment` → `identityCommitment`

### 详细修复报告

详见：[`docs/contracts-circuits-interface-fix.md`](file:///d:/Desktop/projects/trustaid-platform/docs/contracts-circuits-interface-fix.md)

---

## 📋 第四阶段：重新编译受影响的电路

**执行时间**: 等待第二阶段完成后  
**状态**: 📋 待执行

### 需要重新编译的电路

仅 `anti_sybil_verifier` 需要重新编译（因为修改了 public 输出）

**执行命令**:
```bash
cd D:\Desktop\projects\trustaid-platform\circuits
npm run compile anti_sybil_verifier
```

**预期输出**:
```
[编译] anti_sybil_verifier
[成功] R1CS: build/anti_sybil_verifier/anti_sybil_verifier.r1cs
[成功] WASM: build/anti_sybil_verifier_js/anti_sybil_verifier.wasm
```

**验证步骤**:
```bash
# 检查 R1CS 文件大小
dir build\anti_sybil_verifier\anti_sybil_verifier.r1cs

# 应该 ~1,679 KB（与之前相近）
```

---

## 📋 第五阶段：重新执行 Trusted Setup

**执行时间**: 第四阶段完成后  
**状态**: 📋 待执行

### 需要重新执行 Trusted Setup 的电路

仅 `anti_sybil_verifier` 需要重新执行

**执行命令**:
```bash
cd D:\Desktop\projects\trustaid-platform\circuits
node scripts/zk-setup-fast.mjs anti_sybil_verifier
```

**预期输出**:
```
============================================================
  零知识证明可信设置（快速版 - 跳过熵贡献）
============================================================
[电路名称] anti_sybil_verifier
[PTAU 文件] pot15_final.ptau
============================================================

步骤 1: 初始化 zkey（Groth16 Setup）
[执行] npx snarkjs groth16 setup ...
✅ Groth16 Setup 完成

步骤 2: 复制 zkey（跳过熵贡献）
[OK] 复制成功

步骤 3: 导出 vkey
[OK] vkey.json 已导出

步骤 4: 导出 Solidity Verifier
[OK] Groth16Verifier.sol 已导出
```

**验证步骤**:
```bash
# 检查生成的文件
dir build\anti_sybil_verifier\anti_sybil_verifier_final.zkey
dir build\anti_sybil_verifier\vkey.json
type ..\contracts\contracts\verifiers\Groth16Verifier.sol
```

---

## 📋 第六阶段：部署合约

**执行时间**: 第五阶段完成后  
**状态**: 📋 待执行

### 前置条件检查

- [ ] 所有电路的 `*_final.zkey` 已生成
- [ ] 所有电路的 `vkey.json` 已生成
- [ ] `Groth16Verifier.sol` 已生成
- [ ] `anti_sybil_verifier` 已重新编译并执行 Trusted Setup
- [ ] `ClaimVaultZK.sol` 已修改

### 部署步骤

#### 1. 启动本地区块链

```bash
cd D:\Desktop\projects\trustaid-platform\contracts
npx hardhat node
```

**预期输出**:
```
Started HTTP and WebSocket JSON-RPC Server at http://127.0.0.1:8545/
Accounts
========
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
...
```

#### 2. 部署合约

**在新终端执行**:
```bash
cd D:\Desktop\projects\trustaid-platform\contracts
npm run deploy:local
```

**预期输出**:
```
Deploying contracts to localhost...
Groth16Verifier deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
ClaimVaultZK deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
IdentityRegistry deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

#### 3. 验证部署

```bash
# 检查合约是否部署成功
npx hardhat run scripts/verify-deployment.js --network localhost
```

---

## 📋 第七阶段：运行测试验证

**执行时间**: 第六阶段完成后  
**状态**: 📋 待执行

### 测试范围

#### 1. 单元测试

```bash
cd D:\Desktop\projects\trustaid-platform\contracts
npm test
```

**预期测试用例**:
```
  ClaimVaultZK
    ✔ rejects replay nullifier after successful claim
    ✔ reverts when amount out of bounds on-chain
    ✔ reverts when timestamp out of window (新增)
    ✔ accepts valid claim with correct proof
    ✔ emits ClaimAirdropped event with correct parameters

  IdentityRegistry
    ✔ registers identity commitment
    ✔ rejects inactive commitment
```

#### 2. 集成测试

```bash
# 端到端测试：证明生成 + 合约验证
cd D:\Desktop\projects\trustaid-platform
npm run test:e2e
```

**测试流程**:
1. 前端生成证明（使用新的 public inputs）
2. 调用合约 `claimAirdrop` 方法
3. 验证交易成功
4. 检查 Nullifier 已记录
5. 检查事件已触发

#### 3. Gas 消耗测试

```bash
npx hardhat test --gas
```

**预期结果**:
```
  ClaimVaultZK:claimAirdrop
    ✔ valid claim: 150,000 gas
    ✔ with timestamp check: +300 gas
    ✔ with project ID check: +200 gas
```

---

## 🔍 实时监控命令

### 监控 Trusted Setup 进度

```bash
cd D:\Desktop\projects\trustaid-platform\circuits
node scripts/monitor-setup.mjs
```

**输出示例**:
```
================================================================================
  Trusted Setup 进度监控
================================================================================

[1/8] identity_commitment
    状态：🔧 Setup 中
    文件：52.3 MB

[2/8] anti_sybil_verifier
    状态：⏳ 准备中

...

================================================================================
进度：0/8 完成，1 进行中
================================================================================
```

### 手动检查文件

```bash
# 检查 zkey 文件
dir build\identity_commitment\*.zkey

# 检查 vkey 文件
dir build\identity_commitment\vkey.json

# 检查 Verifier 合约
type ..\contracts\contracts\verifiers\Groth16Verifier.sol
```

---

## ⚠️ 风险与缓解措施

### 风险 1: Trusted Setup 失败

**可能原因**:
- 内存不足
- 磁盘空间不足
- PTAU 文件损坏

**缓解措施**:
- ✅ 设置 `NODE_OPTIONS=--max-old-space-size=8192`
- ✅ 确保磁盘空间 > 5GB
- ✅ 验证 PTAU 文件完整性

### 风险 2: 接口仍然不匹配

**可能原因**:
- 电路修改遗漏
- 合约读取顺序错误

**缓解措施**:
- ✅ 使用详细的注释标注每个索引
- ✅ 在合约中添加 `require` 检查长度
- ✅ 编写测试验证 public signals 顺序

### 风险 3: 证明生成失败

**可能原因**:
- WASM 加载失败
- public inputs 格式错误
- 浏览器兼容性问题

**缓解措施**:
- ✅ 使用 WebWorker 加载 WASM
- ✅ 严格检查 public inputs 数组长度
- ✅ 提供详细的错误映射

---

## 📊 成功标准

### 第二阶段完成标志

- [ ] 所有 8 个电路生成 `*_final.zkey` (~50MB)
- [ ] 所有 8 个电路生成 `vkey.json` (~1KB)
- [ ] 生成 `Groth16Verifier.sol` 合约

### 第五阶段完成标志

- [ ] `anti_sybil_verifier` 重新编译成功
- [ ] `anti_sybil_verifier_final.zkey` 重新生成
- [ ] `vkey.json` 重新生成
- [ ] `Groth16Verifier.sol` 更新

### 第六阶段完成标志

- [ ] 本地区块链正常运行
- [ ] 所有合约部署成功
- [ ] 获得合约地址

### 第七阶段完成标志

- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] Gas 消耗在可接受范围内
- [ ] 时间窗口验证生效

---

## 🎯 下一步行动

### 立即执行（等待中）

1. ⏳ 等待当前 Trusted Setup 完成（预计 80-90 分钟）
2. 📊 使用 `monitor-setup.mjs` 监控进度
3. 📝 记录生成的文件路径

### 随后执行

1. 🔧 重新编译 `anti_sybil_verifier`
2. 🔐 重新执行 `anti_sybil_verifier` Trusted Setup
3. 🚀 部署所有合约
4. 🧪 运行完整测试套件

---

## 📞 需要帮助？

如果遇到错误，请检查：

1. **编译错误**: 查看 `build/` 目录是否有 `.r1cs` 文件
2. **Setup 错误**: 查看 `params/pot15_final.ptau` 是否存在
3. **内存错误**: 设置 `NODE_OPTIONS=--max-old-space-size=8192`
4. **部署错误**: 确保本地区块链正在运行
5. **验证错误**: 检查 public signals 顺序和长度

---

**文档创建时间**: 2026-04-11  
**最后更新**: 2026-04-11  
**执行环境**: Windows 10/11, Node.js v24.10.0

**相关文件**:
- [`docs/contracts-circuits-interface-fix.md`](file:///d:/Desktop/projects/trustaid-platform/docs/contracts-circuits-interface-fix.md)
- [`docs/execution-status-report.md`](file:///d:/Desktop/projects/trustaid-platform/docs/execution-status-report.md)
