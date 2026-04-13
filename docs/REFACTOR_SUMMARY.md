# 电路层重构总结

## ✅ 已完成任务

### 1. 文件结构优化

#### 移动电路文件
- ✅ 将 `claims/antiSybilClaim.circom` 移动至 `src/anti_sybil_claim.circom`
- ✅ 删除空的 `claims/` 目录
- ✅ 更新 include 路径为标准格式

**优化前**:
```circom
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
```

**优化后**:
```circom
include "circomlib/comparators.circom";
include "circomlib/poseidon.circom";
```

### 2. 脚本优化

#### 新增清理脚本
创建 `scripts/clean.mjs`，提供以下功能：
- ✅ `npm run clean` - 清理所有（保留最终 PTAU）
- ✅ `npm run clean:zkey` - 仅清理 zkey 文件
- ✅ `npm run clean:build` - 仅清理 build 目录（保留 zkey）
- ✅ `npm run clean:all` - 清理所有（包括 PTAU）

#### 修复错误处理
- ✅ 修复 `clean.mjs` 的 main 函数返回值问题
- ✅ 修复 `zk-export-verifier.mjs` 的 main 函数返回值问题

#### 统一错误处理模式
```javascript
try {
  main();
} catch (err) {
  console.error('[错误]', err);
  process.exit(1);
}
```

### 3. 文档完善

#### 创建快速参考文档
创建 `scripts/README.md`，包含：
- ✅ 编译电路命令
- ✅ Trusted Setup 流程
- ✅ 导出验证器合约
- ✅ 清理构建产物
- ✅ 完整工作流示例
- ✅ 故障排除指南

## 📁 最终文件结构

```
circuits/
├── src/                          # 电路源代码
│   ├── anti_sybil_claim.circom   # [新增] 防女巫申领电路
│   ├── anti_sybil_verifier.circom
│   ├── confidential_transfer.circom
│   ├── history_anchor.circom
│   ├── identity_commitment.circom
│   ├── multi_sig_proposal.circom
│   ├── privacy_payment.circom
│   ├── private_payment.circom
│   ├── reputation_verifier.circom
│   └── utils/                    # 工具电路
│
├── scripts/                      # 构建脚本
│   ├── clean.mjs                 # [新增] 清理脚本
│   ├── compile-all.mjs
│   ├── compile-circuit.mjs
│   ├── generate-ptau-local.mjs
│   ├── info.mjs
│   ├── monitor-setup.mjs
│   ├── zk-export-verifier.mjs    # [已修复]
│   ├── zk-prove.mjs
│   ├── zk-setup-all-fast.mjs
│   ├── zk-setup-all.mjs
│   ├── zk-setup-fast.mjs
│   ├── zk-setup.mjs
│   ├── zk-verify.mjs
│   └── README.md                 # [新增] 快速参考
│
├── build/                        # 编译产物
│   └── <circuit>/
│       ├── <circuit>.r1cs
│       ├── <circuit>_final.zkey
│       └── vkey.json
│
├── params/                       # PTAU 文件
│   ├── pot12_final.ptau
│   ├── pot14_final.ptau
│   ├── pot15_final.ptau
│   ├── pot16_final.ptau
│   └── log.txt
│
└── package.json                  # [已更新] 新增 clean 和 info 命令
```

## 🎯 优化效果

### 代码质量
- ✅ 统一 include 路径格式
- ✅ 修复所有脚本的错误处理
- ✅ 删除冗余目录结构

### 开发体验
- ✅ 新增 4 个清理命令
- ✅ 新增 info 命令查看电路信息
- ✅ 提供完整的快速参考文档

### 维护性
- ✅ 电路文件集中在 src/ 目录
- ✅ 脚本功能明确，注释完善
- ✅ 错误处理统一，易于调试

## 📋 可用命令汇总

### 编译相关
```bash
npm run compile:circuit <name>    # 编译单个电路
npm run compile:all               # 编译所有电路
npm run compile:all:wasm          # 编译所有电路（含 WASM）
```

### Trusted Setup
```bash
npm run zk:setup <name>           # 标准流程（两方熵贡献）
npm run zk:setup:all              # 批量标准流程
npm run zk:setup:fast <name>      # 快速流程（无熵贡献）
npm run zk:setup:fast:all         # 批量快速流程
```

### 导出验证器
```bash
npm run zk:export:all             # 导出所有验证器
npm run zk:export:circuit <name>  # 导出单个验证器
```

### 清理
```bash
npm run clean                     # 清理所有（保留最终 PTAU）
npm run clean:zkey                # 仅清理 zkey 文件
npm run clean:build               # 仅清理 build 目录（保留 zkey）
npm run clean:all                 # 清理所有（包括 PTAU）
```

### 信息查看
```bash
npm run info                      # 查看电路层信息
```

## 🚀 推荐工作流

### 开发阶段
```bash
# 1. 修改电路代码
# 2. 清理旧产物（保留 zkey）
npm run clean:build

# 3. 重新编译
npm run compile:all

# 4. 快速 Trusted Setup
npm run zk:setup:fast:all

# 5. 导出验证器
npm run zk:export:all

# 6. 查看结果
npm run info
```

### 生产部署
```bash
# 1. 完全清理
npm run clean:all

# 2. 重新生成 PTAU（或使用官方 PTAU）
npm run ptau:generate

# 3. 编译所有电路
npm run compile:all

# 4. 标准 Trusted Setup（两方熵贡献）
npm run zk:setup:all

# 5. 导出验证器
npm run zk:export:all

# 6. 验证结果
npm run info
```

## ⚠️ 注意事项

1. **PTAU 文件保留**: `npm run clean` 默认保留最终 PTAU 文件
2. **zkey 安全**: 包含熵贡献的 zkey 文件不应公开分享
3. **清理前确认**: 使用 `npm run clean:all` 前请确认不再需要现有 zkey 文件
4. **内存要求**: Trusted Setup 需要充足内存，建议关闭其他应用程序

## 📊 统计信息

- **电路总数**: 9 个（含 anti_sybil_claim）
- **脚本总数**: 13 个
- **新增命令**: 5 个（4 个 clean + 1 个 info）
- **修复错误**: 2 个（clean.mjs + zk-export-verifier.mjs）
- **文档页数**: 1 页（scripts/README.md）
