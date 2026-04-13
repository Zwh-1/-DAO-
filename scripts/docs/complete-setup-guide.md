# 🚀 从零开始：电路编译到部署完整指南

## 📋 流程概览

```
1. 编译电路 (Circom → R1CS + WASM)
   ↓
2. Trusted Setup (生成 zkey 文件)
   ↓
3. 导出验证密钥 (vkey.json)
   ↓
4. 导出 Solidity 验证器合约
   ↓
5. 部署验证器合约到区块链
   ↓
6. 运行测试验证
```

---

## 🛠️ 第一步：编译所有电路

### 1.1 检查环境

```bash
cd D:\Desktop\projects\trustaid-platform\circuits

# 检查 Node.js 版本（要求 >= 18）
node --version

# 检查 Circom 版本
circom --version

# 检查依赖
npm install
```

### 1.2 编译单个电路

```bash
# 编译 identity_commitment
npm run compile identity_commitment

# 编译 anti_sybil_verifier
npm run compile anti_sybil_verifier

# 编译其他电路...
```

### 1.3 批量编译所有电路

```bash
# 编译所有电路（不生成 WASM）
npm run compile:all

# 或者生成 WASM（用于前端证明生成）
npm run compile:all:wasm
```

**预期输出**：
```
[编译] identity_commitment
[成功] R1CS: build/identity_commitment/identity_commitment.r1cs
[成功] WASM: build/identity_commitment/identity_commitment.wasm
```

**输出文件**：
- `build/<电路名>/<电路名>.r1cs` - 电路约束文件
- `build/<电路名>/<电路名>.wasm` - WASM 证明生成器（可选）

---

## 🔐 第二步：Trusted Setup（生成 zkey 文件）

### 2.1 检查 PTAU 文件

```bash
# 检查 pot15_final.ptau 是否存在
dir params\pot15_final.ptau
```

如果不存在，请手动下载：
- 下载地址：https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau
- 保存到：`params\pot15_final.ptau`
- 文件大小：约 516 MB

### 2.2 执行 Trusted Setup（快速版）

```bash
# 单个电路
node scripts/zk-setup-fast.mjs identity_commitment

# 所有电路（批量执行）
node scripts/zk-setup-all-fast.mjs
```

**执行步骤**：
1. 检查 PTAU 文件
2. 检查 R1CS 文件
3. Groth16 Setup（生成 _0000.zkey）
4. 复制为 _final.zkey（跳过熵贡献）
5. 导出 vkey.json
6. 导出 Solidity Verifier 合约

**预期输出**：
```
============================================================
  零知识证明可信设置（快速版 - 跳过熵贡献）
============================================================
[电路名称] identity_commitment
[PTAU 文件] pot15_final.ptau

[OK] PTAU 文件：516.1 MB
[OK] R1CS 文件已存在

============================================================
步骤 1: 初始化 zkey（Groth16 Setup）
============================================================
[执行] npx snarkjs groth16 setup ...

[OK] zkey 初始化成功

============================================================
步骤 2: 复制 zkey（跳过熵贡献）
============================================================
[复制] identity_commitment_0000.zkey → identity_commitment_final.zkey

============================================================
步骤 3: 导出验证密钥
============================================================
[OK] 验证密钥导出成功：vkey.json

============================================================
步骤 4: 导出 Solidity 验证器合约
============================================================
[OK] Solidity 验证器导出成功

============================================================
✅ Trusted Setup 完成（快速版）
============================================================
[电路] identity_commitment
[zkey] build\identity_commitment\identity_commitment_final.zkey
[vkey] build\identity_commitment\vkey.json
[Verifier] ..\contracts\contracts\verifiers\Groth16Verifier.sol
```

---

## 📦 第三步：验证生成的文件

### 3.1 检查 zkey 文件

```bash
# 检查文件大小（应该约 50MB）
dir build\identity_commitment\*.zkey
```

**预期结果**：
- `identity_commitment_0000.zkey` - 初始 zkey（~50MB）
- `identity_commitment_final.zkey` - 最终 zkey（~50MB）

### 3.2 检查 vkey 文件

```bash
# 检查 vkey.json（应该约 1KB）
dir build\identity_commitment\vkey.json
type build\identity_commitment\vkey.json
```

### 3.3 检查 Solidity 验证器合约

```bash
# 检查生成的合约
type ..\contracts\contracts\verifiers\Groth16Verifier.sol
```

**注意**：每次执行 Trusted Setup 都会覆盖此文件！

---

## 📝 第四步：部署验证器合约

### 4.1 安装合约依赖

```bash
cd D:\Desktop\projects\trustaid-platform\contracts

npm install
```

### 4.2 配置 Hardhat

编辑 `hardhat.config.js`：

```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
```

### 4.3 启动本地区块链

```bash
# 在新终端执行
npx hardhat node
```

**预期输出**：
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

### 4.4 部署合约

```bash
# 在另一个终端执行
npm run deploy:local
```

**预期输出**：
```
Deploying contracts to localhost...
Groth16Verifier deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
ClaimVaultZK deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
IdentityRegistry deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

---

## 🧪 第五步：运行测试

### 5.1 运行单元测试

```bash
npm test
```

**预期输出**：
```
  ClaimVaultZK
    ✔ rejects replay nullifier after successful claim
    ✔ reverts when amount out of bounds on-chain

  ClaimVault
    ✔ should deploy
    ✔ should allow owner to pause/unpause

  Governance
    ✔ should deploy
    ✔ should create proposal
```

### 5.2 运行集成测试

```bash
npm run test:integration
```

---

## 🔄 批量执行所有电路

### 创建批量执行脚本

我已为你创建 [`zk-setup-all-fast.mjs`](file:///d:/Desktop/projects/trustaid-platform/circuits/scripts/zk-setup-all-fast.mjs)：

```javascript
#!/usr/bin/env node

/**
 * 批量执行所有电路的 Trusted Setup（快速版）
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

// 所有电路列表
const CIRCUITS = [
  'identity_commitment',
  'anti_sybil_verifier',
  'history_anchor',
  'confidential_transfer',
  'multi_sig_proposal',
  'privacy_payment',
  'private_payment',
  'reputation_verifier',
];

// 执行命令
function execCommand(command) {
  console.log(`\n[执行] ${command}`);
  try {
    execSync(command, {
      cwd: circuitsRoot,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    console.error(`[失败] ${error.message}`);
    return false;
  }
}

// 主函数
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  批量 Trusted Setup（快速版）');
  console.log('='.repeat(60));
  console.log(`[电路数量] ${CIRCUITS.length}`);
  console.log(`[预计时间] ${CIRCUITS.length * 10} 分钟`);
  console.log('='.repeat(60) + '\n');

  let successCount = 0;

  for (const circuit of CIRCUITS) {
    console.log('\n' + '='.repeat(60));
    console.log(`[${successCount + 1}/${CIRCUITS.length}] Trusted Setup: ${circuit}`);
    console.log('='.repeat(60));

    const script = path.join(__dirname, 'zk-setup-fast.mjs');
    const command = `node "${script}" ${circuit}`;

    if (execCommand(command)) {
      successCount++;
      console.log(`✅ ${circuit} 完成`);
    } else {
      console.error(`❌ ${circuit} 失败`);
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ 批量 Trusted Setup 完成`);
  console.log(`[成功] ${successCount}/${CIRCUITS.length} 个电路`);
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### 执行批量脚本

```bash
cd D:\Desktop\projects\trustaid-platform\circuits
node scripts/zk-setup-all-fast.mjs
```

**预计耗时**：8 个电路 × 10 分钟 = **80 分钟**

---

## 📊 完整执行清单

### 编译阶段
- [ ] 编译 `identity_commitment`
- [ ] 编译 `anti_sybil_verifier`
- [ ] 编译 `history_anchor`
- [ ] 编译 `confidential_transfer`
- [ ] 编译 `multi_sig_proposal`
- [ ] 编译 `privacy_payment`
- [ ] 编译 `private_payment`
- [ ] 编译 `reputation_verifier`

### Trusted Setup 阶段
- [ ] `identity_commitment` zkey 生成
- [ ] `anti_sybil_verifier` zkey 生成
- [ ] `history_anchor` zkey 生成
- [ ] `confidential_transfer` zkey 生成
- [ ] `multi_sig_proposal` zkey 生成
- [ ] `privacy_payment` zkey 生成
- [ ] `private_payment` zkey 生成
- [ ] `reputation_verifier` zkey 生成

### 部署阶段
- [ ] 启动本地区块链
- [ ] 部署 Groth16Verifier
- [ ] 部署 ClaimVaultZK
- [ ] 部署 IdentityRegistry
- [ ] 部署其他合约

### 测试阶段
- [ ] 运行单元测试
- [ ] 运行集成测试
- [ ] 验证所有功能正常

---

## ⚡ 快速执行命令

### 一键执行所有步骤

```bash
# 1. 编译所有电路
cd D:\Desktop\projects\trustaid-platform\circuits
npm run compile:all

# 2. 执行所有电路的 Trusted Setup
node scripts/zk-setup-all-fast.mjs

# 3. 部署合约
cd ../contracts
npm run deploy:local

# 4. 运行测试
npm test
```

---

## 🐛 常见问题

### Q1: Groth16 Setup 卡住
**解决**：使用快速版本，跳过熵贡献
```bash
node scripts/zk-setup-fast.mjs <电路名>
```

### Q2: 内存不足
**解决**：增加 Node.js 内存限制
```bash
set NODE_OPTIONS=--max-old-space-size=8192
```

### Q3: PTAU 文件不存在
**解决**：手动下载 pot15_final.ptau
```bash
# 下载地址：
https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau
```

### Q4: 合约部署失败
**解决**：检查本地区块链是否运行
```bash
npx hardhat node
```

---

## 📈 性能优化

### 1. 使用 SSD 存储
- 将项目放在 SSD 上
- 避免使用网络驱动器

### 2. 关闭 Windows Defender 实时扫描
```powershell
Add-MpPreference -ExclusionPath "D:\Desktop\projects\trustaid-platform"
```

### 3. 增加 Node.js 内存
```bash
set NODE_OPTIONS=--max-old-space-size=8192
```

### 4. 并行编译电路
```bash
# 使用并行脚本（如果可用）
npm run compile:parallel
```

---

## ✅ 验证成功标准

### 编译阶段
- ✅ 所有 `.circom` 文件编译成功
- ✅ 生成对应的 `.r1cs` 文件
- ✅ 生成对应的 `.wasm` 文件（可选）

### Trusted Setup 阶段
- ✅ 所有电路生成 `_final.zkey`（~50MB）
- ✅ 所有电路生成 `vkey.json`（~1KB）
- ✅ 生成 `Groth16Verifier.sol`

### 部署阶段
- ✅ 本地区块链正常运行
- ✅ 所有合约部署成功
- ✅ 获得合约地址

### 测试阶段
- ✅ 所有单元测试通过
- ✅ 所有集成测试通过
- ✅ 无 Gas 超限错误

---

**指南创建时间**: 2026-04-11  
**适用版本**: Circom 2.1.6, snarkjs 0.7.2, Hardhat 2.x  
**操作系统**: Windows 10/11
