# 电路层开发脚本快速参考

## 📦 编译电路

```bash
# 编译单个电路
npm run compile:circuit <circuit_name>

# 编译所有电路
npm run compile:all

# 编译所有电路（包含 WASM）
npm run compile:all:wasm
```

## 🔐 生成 PTAU 文件

```bash
# 本地生成 PTAU（快速仪式）
npm run ptau:generate
```

**当前配置**: `pot16_final.ptau` (72 MB, 支持 65536 约束)

## 🔑 Trusted Setup

### 标准流程（两方熵贡献）
```bash
# 单个电路
npm run zk:setup <circuit_name>

# 所有电路
npm run zk:setup:all
```

### 快速流程（无熵贡献）
```bash
# 单个电路
npm run zk:setup:fast <circuit_name>

# 所有电路
npm run zk:setup:fast:all
```

## 📤 导出验证器合约

```bash
# 导出所有电路的验证器
npm run zk:export:all

# 导出单个电路
npm run zk:export:circuit <circuit_name>
```

## 🧹 清理构建产物

```bash
# 清理所有（保留最终 PTAU）
npm run clean

# 仅清理 zkey 文件
npm run clean:zkey

# 仅清理 build 目录（保留 zkey）
npm run clean:build

# 清理所有（包括 PTAU）
npm run clean:all
```

## ℹ️ 查看信息

```bash
# 查看电路层信息
npm run info
```

## 🧪 运行测试

```bash
# 运行测试
npm test

# 运行 Circom 测试
npm run test:circom
```

## 📊 完整工作流

### 从零开始
```bash
# 1. 编译所有电路
npm run compile:all

# 2. 生成 PTAU
npm run ptau:generate

# 3. Trusted Setup（标准流程）
npm run zk:setup:all

# 4. 导出验证器合约
npm run zk:export:all

# 5. 查看结果
npm run info
```

### 快速开发
```bash
# 1. 清理（保留 zkey）
npm run clean:build

# 2. 重新编译
npm run compile:all

# 3. 快速 Trusted Setup
npm run zk:setup:fast:all

# 4. 导出验证器
npm run zk:export:all
```

## 📁 输出文件位置

### Build 目录
```
circuits/build/<circuit>/
  ├── <circuit>.r1cs              # 电路约束文件
  ├── <circuit>.sym               # 符号表
  ├── <circuit>_final.zkey        # 最终证明密钥
  ├── vkey.json                   # 验证密钥
  └── Groth16Verifier.sol         # Solidity 验证器
```

### Params 目录
```
circuits/params/
  ├── pot16_final.ptau            # 最终 PTAU 文件
  └── log.txt                     # 生成日志
```

### Contracts 目录
```
contracts/contracts/verifiers/
  ├── <circuit>_verifier.sol      # 验证器合约
  └── ...
```

## ⚙️ 配置说明

### PTAU 配置
- **Power**: 16 (2^16 = 65536 约束)
- **文件大小**: ~72 MB
- **适用电路**: 所有 8 个电路

### 电路列表
1. identity_commitment
2. anti_sybil_verifier
3. history_anchor
4. confidential_transfer
5. multi_sig_proposal
6. privacy_payment
7. private_payment
8. reputation_verifier

## 🛠️ 故障排除

### 电路太大
如果遇到 "circuit too big for this power of tau ceremony"：
- 当前使用 pot16（65536 约束）
- 如仍不够，需生成更大的 PTAU（pot17, pot18...）

### 内存不足
Trusted Setup 需要大量内存：
- 关闭其他应用程序
- 增加 Node.js 内存限制：`node --max-old-space-size=4096 scripts/zk-setup.mjs`

### 验证器合约缺失
运行 `npm run zk:export:all` 重新导出

## 📝 注意事项

1. **生产环境**：使用官方 MPC 仪式生成的 PTAU
2. **开发环境**：可使用本地生成的 PTAU
3. **zkey 安全**：包含熵贡献的 zkey 文件不应公开
4. **PTAU 重用**：同一 PTAU 可用于多个电路
