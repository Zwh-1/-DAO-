# TrustAID Circuits - 零知识证明电路层

## 📋 概述

本模块提供基于 Circom 的零知识证明电路开发和部署能力，用于 TrustAID 去中心化互助平台的隐私保护和抗女巫攻击功能。

## 🎯 核心功能

- ✅ **身份承诺**：将用户身份匿名化后提交到 Merkle 树
- ✅ **抗女巫验证**：证明用户符合空投条件，同时保护隐私
- ✅ **Nullifier 机制**：防止重复申领和重放攻击
- ✅ **Merkle 树证明**：高效的白名单验证
- ✅ **时间戳验证**：验证申领时间是否在有效窗口内
- ✅ **多重签名**：动态权重阈值授权
- ✅ **隐私余额**：带 Nullifier 的余额充足性证明
- ✅ **信誉评分**：基于历史行为的信誉计算
- ✅ **保密支付**：范围证明与零知识支付
- ✅ **Merkle 锚定**：历史行为锚定到 Merkle 树（新增）
- ✅ **余额状态树**：动态余额更新与防双花（新增）

## 🚀 快速开始

### 安装依赖

```bash
cd circuits
npm install
```

### 编译电路

```bash
# 编译身份承诺电路
npm run compile:identity

# 编译抗女巫电路
npm run compile:antisybil

# 编译所有电路
npm run compile:circuits
```

### 完整流程

```bash
# 1. 编译电路
npm run compile:identity

# 2. 可信设置（生成 zkey）
npm run zk:setup

# 3. 生成证明
npm run zk:prove

# 4. 验证证明
npm run zk:verify
```

## � NPM 指令

### 编译相关

| 指令 | 功能 | 说明 |
|------|------|------|
| `npm run compile:identity` | 编译身份承诺电路 | 生成 R1CS 和符号表 |
| `npm run compile:antisybil` | 编译抗女巫电路 | Merkle 树深度=8 |
| `npm run compile:circuits` | 编译所有电路 | 默认编译 identity_commitment |
| `npm run compile:all` | 编译合约和电路 | 一次性编译全部 |

### 测试相关

| 指令 | 功能 | 说明 |
|------|------|------|
| `npm run test:circuits` | 运行电路测试 | 基础测试 |
| `npm run test:circuits:full` | 完整电路测试 | 包含重型测试 |
| `npm run test:all` | 运行所有测试 | 合约 + 电路 |

### 零知识证明相关

| 指令 | 功能 | 耗时 |
|------|------|------|
| `npm run zk:setup` | 可信设置（生成 zkey） | 5-10 分钟 |
| `npm run zk:prove` | 生成本地证明 | 1-5 秒 |
| `npm run zk:verify` | 验证证明有效性 | < 1 秒 |
| `npm run zk:full` | 完整流程 | 包含以上所有步骤 |

### 工具相关

| 指令 | 功能 | 说明 |
|------|------|------|
| `npm run clean:circuits` | 清理编译产物 | 保留 zkey 文件 |
| `npm run clean` | 清理所有构建产物 | 包含合约和电路 |
| `npm run info:circuits` | 显示电路信息 | 约束数、状态等 |

## � 目录结构

```
circuits/
├── scripts/
│   ├── zk-setup.mjs      # 可信设置脚本
│   ├── zk-prove.mjs      # 证明生成脚本
│   ├── zk-verify.mjs     # 证明验证脚本
│   ├── clean.mjs         # 清理脚本
│   ├── info.mjs          # 信息显示脚本
│   └── README.md         # 脚本使用指南
├── src/
│   ├── identity_commitment.circom    # 身份承诺电路
│   ├── anti_sybil_verifier.circom   # 抗女巫验证电路
│   ├── multi_sig_proposal.circom    # 多重签名示例
│   ├── privacy_payment.circom       # 隐私支付示例
│   ├── reputation_verifier.circom   # 信誉评分示例
│   ├── confidential_transfer.circom # 保密转账示例
│   ├── history_anchor.circom        # 历史锚定示例（新增）
│   ├── private_payment.circom       # 隐私支付状态更新（新增）
│   └── utils/
│       ├── merkle_tree.circom       # Merkle 树组件
│       ├── poseidon_hasher.circom   # Poseidon 哈希组件
│       ├── timestamp_validator.circom  # 时间戳验证组件
│       ├── weighted_threshold_authorization.circom  # 多重签名授权
│       ├── privacy_balance_proof.circom  # 隐私余额证明
│       ├── reputation_calculator.circom  # 信誉评分计算
│       ├── range_payment.circom     # 范围证明支付
│       ├── merkle_inclusion_proof.circom  # Merkle 包含证明（新增）
│       └── balance_state_tree.circom      # 余额状态树（新增）（新增）
├── build/                 # 编译输出目录
│   └── <circuit>/
│       ├── <circuit>.r1cs
│       ├── <circuit>.sym
│       ├── <circuit>_final.zkey
│       └── vkey.json
├── params/                # PTAU 参数文件
│   └── pot12_final.ptau
├── proofs/                # 生成的证明
│   ├── proof_<circuit>_<timestamp>.json
│   └── public_<circuit>_<timestamp>.json
├── compile.bat            # Windows 编译脚本
└── package.json
```

## � 电路说明

### identity_commitment.circom

**功能**：生成身份承诺

**输入信号**：
- `social_id_hash` (public)：Web2 社交账号哈希
- `secret` (private)：用户秘密
- `trapdoor` (private)：陷阱门

**输出信号**：
- `identity_commitment`：身份承诺

**约束数量**：605

**用途**：
- 将用户身份匿名化
- 提交到 Merkle 树白名单
- 保护用户隐私

---

### anti_sybil_verifier.circom

**功能**：抗女巫攻击验证器

**输入信号**：
- `secret` (private)：用户秘密
- `airdrop_project_id` (private)：空投项目 ID
- `pathElements[]` (private)：Merkle 树路径兄弟节点
- `pathIndex[]` (private)：Merkle 树路径索引
- `merkle_root` (public)：Merkle 树根
- `identity_commitment` (public)：身份承诺
- `nullifier` (public)：空值标识符
- `user_level` (public)：用户等级
- `min_level` (public)：最低等级要求
- `claim_amount` (public)：申领金额
- `min_amount` / `max_amount` (public)：金额范围
- `claim_ts` (public)：申领时间戳
- `ts_start` / `ts_end` (public)：时间窗口

**约束数量**：约 2000-3000（Merkle 树深度=8）

**用途**：
- 验证用户是否符合空投条件
- 保护用户隐私
- 防止重复申领

## 🔒 安全特性

### 隐私保护

- ✅ **私有输入不离端**：secret、trapdoor 等私有数据在本地生成证明
- ✅ **零知识性**：证明不泄露任何私有信息
- ✅ **内存清除**：使用后立即从内存清除私有数据

### 密码学安全

- ✅ **Poseidon 哈希**：电路内使用零知识友好的哈希算法
- ✅ **Keccak256**：链上使用标准哈希算法
- ❌ **严禁 MD5**：不使用已被破解的哈希算法

### 抗攻击机制

- ✅ **Nullifier**：防止重放攻击
- ✅ **时间窗口**：限制申领时间
- ✅ **Merkle 树**：高效的白名单验证
- ✅ **等级检查**：确保用户符合最低要求

## 📊 性能指标

| 指标 | identity_commitment | anti_sybil_verifier |
|------|---------------------|---------------------|
| 约束数量 | 605 | ~2500 |
| 证明生成时间 | < 1 秒 | 2-5 秒 |
| 链上验证 Gas | ~50K | ~150K-300K |
| R1CS 大小 | ~80KB | ~200KB |
| zkey 大小 | ~15MB | ~20MB |

## 🛠️ 环境要求

### 必需

- Node.js >= 16.0.0
- npm >= 7.0.0
- Windows 10/11 或 Linux/Mac

### 可选（用于生成 WASM）

- WSL2（Windows Subsystem for Linux）
- 或 Docker Desktop

### 依赖包

```json
{
  "circom2": "^0.2.22",
  "circomlib": "^2.0.5",
  "snarkjs": "^0.7.2",
  "circom_tester": "^0.0.20"
}
```

## 📖 使用示例

### 1. 编译电路

```bash
cd circuits
npm run compile:identity
```

输出：
- `build/identity_commitment/identity_commitment.r1cs`
- `build/identity_commitment/identity_commitment.sym`

### 2. 可信设置

```bash
# 下载 PTAU 文件（1.8GB）
# 手动下载：https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau
# 保存到：circuits/params/pot12_final.ptau

npm run zk:setup
```

输出：
- `build/identity_commitment/identity_commitment_final.zkey`
- `build/identity_commitment/vkey.json`
- `../contracts/contracts/verifiers/Groth16Verifier.sol`

### 3. 生成证明

```bash
npm run zk:prove
```

输出：
- `proofs/proof_identity_commitment_<timestamp>.json`
- `proofs/public_identity_commitment_<timestamp>.json`

### 4. 验证证明

```bash
npm run zk:verify
```

输出：
- 验证结果（通过/失败）
- 证明详细信息
- Solidity 调用示例

## � 故障排查

### Q1: WASM 文件无法生成

**问题**：circom2 在 Windows 上有兼容性问题

**解决方案**：
```bash
# 使用 WSL
wsl
circom src/identity_commitment.circom --wasm -o build/identity_commitment
```

### Q2: PTAU 文件下载失败

**问题**：文件太大（1.8GB），下载中断

**解决方案**：
- 使用下载工具支持断点续传
- 或使用镜像源
- 验证文件大小（应 > 1.7GB）

### Q3: 证明验证失败

**问题**：输入数据不符合电路约束

**解决方案**：
- 检查输入数据格式
- 验证约束条件（如：金额范围、时间窗口）
- 确保 zkey 和 vkey 来自同一次可信设置

## � 参考资料

- [Circom 官方文档](https://docs.circom.io/)
- [SnarkJS GitHub](https://github.com/iden3/snarkjs)
- [Circomlib 库](https://github.com/iden3/circomlib)
- [零知识证明入门](https://zkproof.org/)
- [Hermez 可信设置](https://github.com/iden3/snarkjs#7-prepare-phase-2)

## 📝 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2026-04-05  
**版本**: 0.1.0
