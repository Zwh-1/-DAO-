# 🔐 Trusted Setup 与 Verifier 合约生成指南

本指南详细说明如何为零知识证明电路执行 Trusted Setup 并生成 Solidity Verifier 合约。

---

## 📋 目录

1. [快速开始](#快速开始)
2. [Trusted Setup（可信设置）](#trusted-setup 可信设置)
3. [生成 Verifier 合约](#生成-verifier-合约)
4. [完整工作流](#完整工作流)
5. [电路特定命令](#电路特定命令)
6. [故障排查](#故障排查)

---

## 🚀 快速开始

### 单个电路的完整流程

```bash
# 1. 编译电路（不含 WASM，快速模式）
npm run compile:confidential

# 2. 执行 Trusted Setup（生成 .zkey 文件）
npm run zk:setup:confidential

# 3. 导出 Solidity Verifier 合约
npm run zk:export:confidential

# 4. 一键完成上述所有步骤
npm run zk:full:confidential
```

### 批量处理所有电路

```bash
# 编译所有电路
npm run compile:circuits:all

# 为所有电路执行 Trusted Setup
npm run zk:setup:all

# 为所有电路导出 Verifier 合约
npm run zk:export:all

# 一键完成所有电路的完整流程
npm run zk:full:all  # 如果存在此命令，或手动串联
```

---

## 🎯 Trusted Setup（可信设置）

Trusted Setup 是为电路生成证明密钥（.zkey 文件）的必要步骤。**电路变更后必须重新执行**。

### 方案 A：使用 npm 脚本（推荐）

```bash
# 单个电路
npm run zk:setup:confidential
npm run zk:setup:multisig
npm run zk:setup:privacy
npm run zk:setup:reputation
npm run zk:setup:history
npm run zk:setup:private

# 所有电路（批量）
npm run zk:setup:all
```

### 方案 B：手动执行（高级）

```bash
cd circuits

# 1. 执行初始设置（需要 powersOfTau 仪式文件）
snarkjs groth16 setup build/confidential_transfer/confidential_transfer.r1cs params/pot15_final.ptau build/confidential_transfer/confidential_transfer_0000.zkey

# 2. 贡献者签名（增强安全性）
snarkjs zkey contribute build/confidential_transfer/confidential_transfer_0000.zkey build/confidential_transfer/confidential_transfer_final.zkey -name="Contributor_1" -v

# 3. 导出验证密钥
snarkjs zkey export verificationkey build/confidential_transfer/confidential_transfer_final.zkey build/confidential_transfer/vkey.json
```

### 输出文件

执行成功后，每个电路将生成：

```
circuits/build/<circuit_name>/
├── <circuit_name>_final.zkey      # 最终证明密钥（用于生成证明）
├── <circuit_name>_0000.zkey       # 初始证明密钥（中间产物）
└── vkey.json                      # 验证密钥（用于链上验证）
```

---

## 📜 生成 Verifier 合约

Verifier 合约是 Solidity 代码，用于在链上验证零知识证明。

### 方案 A：使用 npm 脚本（推荐）

```bash
# 单个电路
npm run zk:export:confidential
npm run zk:export:multisig
npm run zk:export:privacy
npm run zk:export:reputation
npm run zk:export:history
npm run zk:export:private

# 所有电路（批量）
npm run zk:export:all
```

### 方案 B：手动执行

```bash
cd circuits
npx snarkjs zkey export solidityverifier \
  build/confidential_transfer/confidential_transfer_final.zkey \
  contracts/ConfidentialTransferVerifier.sol
```

### 输出文件

```
circuits/contracts/
├── ConfidentialTransferVerifier.sol   # 保密转账验证器
├── MultiSigProposalVerifier.sol       # 多重签名验证器
├── PrivacyPaymentVerifier.sol         # 隐私支付验证器
├── ReputationVerifier.sol             # 信誉评分验证器
├── HistoryAnchorVerifier.sol          # 历史行为锚定验证器
└── PrivatePaymentVerifier.sol         # 隐私支付状态更新验证器
```

---

## 🔄 完整工作流

### 开发流程（单个电路）

```bash
# 1. 修改电路代码
# 编辑 circuits/src/confidential_transfer.circom

# 2. 编译电路
npm run compile:confidential

# 3. 执行 Trusted Setup（电路变更后必须执行）
npm run zk:setup:confidential

# 4. 生成 Verifier 合约
npm run zk:export:confidential

# 5. 测试证明生成与验证
npm run zk:prove confidential_transfer
npm run zk:verify confidential_transfer
```

### 生产部署流程（所有电路）

```bash
# 1. 编译所有电路（快速模式，不含 WASM）
npm run compile:circuits:all

# 2. 为所有电路执行 Trusted Setup
npm run zk:setup:all

# 3. 生成所有 Verifier 合约
npm run zk:export:all

# 4. 部署合约到测试网
npm run deploy:testnet

# 5. 验证部署
npm run zk:verify confidential_transfer
```

---

## 📚 电路特定命令

### 1. ConfidentialTransfer（保密转账）

```bash
# 编译
npm run compile:confidential

# WASM 模式（需要本地生成证明时）
npm run compile:confidential:wasm

# Trusted Setup
npm run zk:setup:confidential

# 导出 Verifier
npm run zk:export:confidential

# 完整流程
npm run zk:full:confidential
```

### 2. MultiSigProposal（多重签名提案）

```bash
npm run compile:multisig
npm run zk:setup:multisig
npm run zk:export:multisig
npm run zk:full:multisig
```

### 3. PrivacyPayment（隐私支付能力验证）

```bash
npm run compile:privacy
npm run zk:setup:privacy
npm run zk:export:privacy
npm run zk:full:privacy
```

### 4. ReputationVerifier（信誉评分验证）

```bash
npm run compile:reputation
npm run zk:setup:reputation
npm run zk:export:reputation
npm run zk:full:reputation
```

### 5. HistoryAnchor（历史行为锚定）

```bash
npm run compile:history
npm run zk:setup:history
npm run zk:export:history
npm run zk:full:history
```

### 6. PrivatePayment（隐私支付状态更新）

```bash
npm run compile:private
npm run zk:setup:private
npm run zk:export:private
npm run zk:full:private
```

---

## 🔧 故障排查

### 问题 1：找不到 .zkey 文件

**错误信息**:
```
[错误] .zkey 文件不存在：...
```

**解决方案**:
```bash
# 先执行 Trusted Setup
npm run zk:setup:confidential
```

### 问题 2：电路编译失败

**错误信息**:
```
Compile FAILED
```

**解决方案**:
```bash
# 1. 检查电路语法
cd circuits
circom src/confidential_transfer.circom --r1cs --sym

# 2. 查看详细错误信息
npm run compile:confidential --verbose

# 3. 清理后重新编译
npm run clean:circuits
npm run compile:confidential
```

### 问题 3：snarkjs 未安装

**错误信息**:
```
npx: command not found: snarkjs
```

**解决方案**:
```bash
# 全局安装 snarkjs
npm install -g snarkjs

# 或本地安装
cd circuits
npm install snarkjs
```

### 问题 4：磁盘空间不足

**错误信息**:
```
No space left on device
```

**解决方案**:
```bash
# 1. 清理旧文件
npm run clean:circuits

# 2. 清理构建缓存
cd circuits
rm -rf build/*/circuit_name_js

# 3. 检查磁盘空间
df -h
```

---

## 📊 命令速查表

### 编译命令

| 命令 | 描述 | WASM |
|------|------|------|
| `npm run compile:confidential` | 编译保密转账电路 | ❌ |
| `npm run compile:confidential:wasm` | 编译 + WASM | ✅ |
| `npm run compile:circuits:all` | 编译所有电路 | ❌ |

### Trusted Setup

| 命令 | 描述 | 电路 |
|------|------|------|
| `npm run zk:setup:confidential` | 保密转账设置 | confidential_transfer |
| `npm run zk:setup:multisig` | 多重签名设置 | multi_sig_proposal |
| `npm run zk:setup:privacy` | 隐私支付设置 | privacy_payment |
| `npm run zk:setup:reputation` | 信誉评分设置 | reputation_verifier |
| `npm run zk:setup:history` | 历史锚定设置 | history_anchor |
| `npm run zk:setup:private` | 状态更新设置 | private_payment |
| `npm run zk:setup:all` | 所有电路设置 | 全部 |

### Verifier 导出

| 命令 | 描述 |
|------|------|
| `npm run zk:export:confidential` | 导出保密转账 Verifier |
| `npm run zk:export:multisig` | 导出多重签名 Verifier |
| `npm run zk:export:privacy` | 导出隐私支付 Verifier |
| `npm run zk:export:reputation` | 导出信誉评分 Verifier |
| `npm run zk:export:history` | 导出历史锚定 Verifier |
| `npm run zk:export:private` | 导出状态更新 Verifier |
| `npm run zk:export:all` | 导出所有 Verifier |

### 完整流程

| 命令 | 描述 |
|------|------|
| `npm run zk:full:confidential` | 编译 + Setup + 导出（保密转账） |
| `npm run zk:full:multisig` | 编译 + Setup + 导出（多重签名） |
| `npm run zk:full:privacy` | 编译 + Setup + 导出（隐私支付） |
| `npm run zk:full:reputation` | 编译 + Setup + 导出（信誉评分） |
| `npm run zk:full:history` | 编译 + Setup + 导出（历史锚定） |
| `npm run zk:full:private` | 编译 + Setup + 导出（状态更新） |

---

## 🎓 进阶知识

### 什么是 Trusted Setup？

Trusted Setup 是生成零知识证明系统所需公共参数的过程。对于 Groth16 证明系统，这些参数包括：

1. **证明密钥（Proving Key）**：用于生成证明（.zkey 文件）
2. **验证密钥（Verification Key）**：用于验证证明（vkey.json）

### 为什么需要贡献者签名？

多轮 Trusted Setup 通过多个独立贡献者的参与，确保即使部分参与者不诚实，最终的设置仍然是安全的。

```bash
# 第一轮（自动化）
snarkjs groth16 setup circuit.r1cs pot15_final.ptau circuit_0000.zkey

# 第二轮（贡献者签名）
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey -name="YourName" -v
```

### 验证密钥的作用

`vkey.json` 包含验证证明所需的公开参数，可以：

1. 在链上合约中使用
2. 在前端验证证明（无需链上交互）
3. 离线验证历史证明

---

## 📞 获取帮助

遇到问题？查看以下资源：

- [Circom 文档](https://docs.circom.io/)
- [SnarkJS GitHub](https://github.com/iden3/snarkjs)
- [零知识证明入门](https://zkproof.org/)

---

**最后更新**: 2026-04-11  
**版本**: v1.0.0
