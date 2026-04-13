# 🔧 Trusted Setup 故障诊断与修复

**诊断时间**: 2026-04-11  
**问题**: Groth16 Setup 卡住，无法生成 zkey 文件  
**影响电路**: `identity_commitment` (及其他 7 个电路)

---

## 📋 问题诊断

### 症状

Terminal#633-654 显示：
```
[执行] npx snarkjs groth16 setup ...
```
进程卡在此步骤，长时间无响应。

### 根本原因分析

1. **Groth16 Setup 计算密集**
   - 需要执行多指数验证（Multi-Exponentiation）
   - 对于 ~1,000 约束的电路，需要 5-15 分钟
   - 对于 ~21,000 约束的电路（如 `private_payment`），需要 30-60 分钟

2. **可能的卡住原因**
   - ⚠️ **内存不足**: Node.js 默认内存限制 2GB
   - ⚠️ **CPU 负载高**: 多指数验证需要大量计算
   - ⚠️ **磁盘 I/O 慢**: zkey 文件写入缓慢
   - ⚠️ **snarkjs 版本问题**: 某些版本存在性能 bug

3. **批量执行的问题**
   - 批量脚本 `zk-setup-all-fast.mjs` 会连续执行 8 个电路
   - 如果第 1 个电路就卡住，后续电路无法执行
   - 无法看到单个电路的详细进度

---

## ✅ 解决方案

### 方案 A：单电路执行（推荐）

**优点**:
- ✅ 可以看到每个电路的详细进度
- ✅ 失败时容易定位问题
- ✅ 可以控制执行节奏

**执行命令**:
```powershell
cd D:\Desktop\projects\trustaid-platform\circuits

# 逐个执行（每个电路完成后休息 1 分钟）
node scripts/zk-setup-fast.mjs identity_commitment
# 等待完成...

node scripts/zk-setup-fast.mjs anti_sybil_verifier
# 等待完成...

# ... 依次执行其他电路
```

### 方案 B：增加内存限制

**适用场景**: 大电路（约束 > 10,000）

**执行命令**:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
node scripts/zk-setup-fast.mjs private_payment
```

### 方案 C：使用详细模式

**适用场景**: 需要查看进度

**修改脚本**（临时）:
```javascript
// 在 zk-setup-fast.mjs 中添加进度输出
console.log(`[进度] 步骤 1/4: Groth16 Setup...`);
console.log(`[进度] 步骤 2/4: 复制 zkey...`);
console.log(`[进度] 步骤 3/4: 导出 vkey...`);
console.log(`[进度] 步骤 4/4: 导出 Verifier...`);
```

---

## 🔍 当前执行状态

### 正在执行

**电路**: `identity_commitment`  
**步骤**: Groth16 Setup（步骤 1/4）  
**预计时间**: 5-15 分钟  
**Terminal**: 17

### 监控命令

```powershell
# 在新终端执行，每 10 秒检查一次
while ($true) {
  Clear-Host
  Write-Host "=== Trusted Setup 进度监控 ===" -ForegroundColor Cyan
  Write-Host ""
  
  $circuit = "identity_commitment"
  $buildDir = "D:\Desktop\projects\trustaid-platform\circuits\build\$circuit"
  
  # 检查文件
  $r1cs = Test-Path "$buildDir\$circuit.r1cs"
  $zkey0 = Test-Path "$buildDir\$circuit`_0000.zkey"
  $zkeyFinal = Test-Path "$buildDir\$circuit`_final.zkey"
  $vkey = Test-Path "$buildDir\vkey.json"
  
  Write-Host "电路：$circuit" -ForegroundColor Yellow
  Write-Host "  R1CS:       $(if ($r1cs) { '✅ 存在' } else { '❌ 缺失' })"
  Write-Host "  zkey_0000:  $(if ($zkey0) { '✅ 存在' } else { '⏳ 生成中...' })"
  Write-Host "  zkey_final: $(if ($zkeyFinal) { '✅ 完成' } else { '⏳ 等待中' })"
  Write-Host "  vkey.json:  $(if ($vkey) { '✅ 完成' } else { '⏳ 等待中' })"
  
  if ($zkeyFinal -and $vkey) {
    Write-Host ""
    Write-Host "✅ 此电路 Trusted Setup 完成！" -ForegroundColor Green
    break
  }
  
  Start-Sleep -Seconds 10
}
```

---

## 📊 预期输出

### 步骤 1: Groth16 Setup（5-15 分钟）

```
============================================================
步骤 1: 初始化 zkey（Groth16 Setup）
============================================================

[执行] npx snarkjs groth16 setup ...

✅ Groth16 Setup 完成
[耗时] 8 分 32 秒
[zkey] build/identity_commitment/identity_commitment_0000.zkey (52.3 MB)
```

### 步骤 2: 复制 zkey（瞬间）

```
============================================================
步骤 2: 复制 zkey（跳过熵贡献）
============================================================

[复制] identity_commitment_0000.zkey → identity_commitment_final.zkey
[OK] 复制成功（未添加额外熵）
```

### 步骤 3: 导出 vkey（1-2 分钟）

```
============================================================
步骤 3: 导出验证密钥（vkey）
============================================================

[执行] npx snarkjs zkey export verificationkey ...

[OK] vkey.json 已导出 (1.2 KB)
```

### 步骤 4: 导出 Verifier（1-2 分钟）

```
============================================================
步骤 4: 导出 Solidity Verifier 合约
============================================================

[执行] npx snarkjs zkey export solidityverifier ...

[OK] Groth16Verifier.sol 已导出
```

---

## ⚠️ 常见问题

### 问题 1: 内存不足

**症状**:
```
<--- Last few GCs --->
[12345:0x12345678]  1234567 ms: Scavenge 2048.0 (2080.5) -> 2047.5 (2081.0) MB
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**解决方案**:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
node scripts/zk-setup-fast.mjs identity_commitment
```

### 问题 2: 进程卡住

**症状**: Groth16 Setup 超过 30 分钟无响应

**解决方案**:
```powershell
# 1. 终止进程
Get-Process node | Where-Object {$_.CommandLine -like "*zk-setup*"} | Stop-Process -Force

# 2. 清理临时文件
Remove-Item "build\identity_commitment\*_0000.zkey" -Force -ErrorAction SilentlyContinue

# 3. 重新执行
node scripts/zk-setup-fast.mjs identity_commitment
```

### 问题 3: PTAU 文件损坏

**症状**:
```
Error: Invalid PTAU file format
```

**解决方案**:
```powershell
# 1. 验证 PTAU 文件
dir params\pot15_final.ptau
# 应该 16.1 MB

# 2. 重新下载（如果损坏）
# 参考之前的下载指南

# 3. 验证哈希
certutil -hashfile params\pot15_final.ptau SHA256
```

### 问题 4: 磁盘空间不足

**症状**:
```
Error: ENOSPC: no space left on device
```

**解决方案**:
```powershell
# 1. 检查磁盘空间
Get-Volume D:

# 2. 清理临时文件
Remove-Item "build\*\*_0000.zkey" -Force -ErrorAction SilentlyContinue

# 3. 确保至少有 5GB 可用空间
```

---

## 📊 8 个电路的执行顺序

### 推荐执行顺序

按约束数量从小到大：

| # | 电路名称 | 约束数量 | 预计时间 | 状态 |
|---|---------|---------|---------|------|
| 1 | `reputation_verifier` | ~800 | 5 分钟 | 📋 等待中 |
| 2 | `identity_commitment` | ~1,000 | 5-15 分钟 | ⏳ 进行中 |
| 3 | `privacy_payment` | ~2,000 | 10-20 分钟 | 📋 等待中 |
| 4 | `confidential_transfer` | ~2,000 | 10-20 分钟 | 📋 等待中 |
| 5 | `multi_sig_proposal` | ~4,000 | 15-30 分钟 | 📋 等待中 |
| 6 | `history_anchor` | 10,837 | 25-40 分钟 | 📋 等待中 |
| 7 | `anti_sybil_verifier` | 12,703 | 30-45 分钟 | 📋 等待中 |
| 8 | `private_payment` | 21,651 | 40-60 分钟 | 📋 等待中 |

**总预计时间**: 140-240 分钟（2.5-4 小时）

### 批量执行脚本（可选）

如果想一次性执行所有电路：

```powershell
cd D:\Desktop\projects\trustaid-platform\circuits

# 设置内存限制
$env:NODE_OPTIONS="--max-old-space-size=8192"

# 执行批量脚本
node scripts/zk-setup-all-fast.mjs

# 监控进度
node scripts/monitor-setup.mjs
```

---

## ✅ 验证步骤

### 单个电路验证

```powershell
# 1. 检查 zkey 文件
dir build\identity_commitment\identity_commitment_final.zkey
# 应该 ~50-60 MB

# 2. 检查 vkey 文件
type build\identity_commitment\vkey.json
# 应该包含 vk_alpha_1, vk_beta_2 等

# 3. 检查 Verifier 合约
type ..\contracts\contracts\verifiers\Groth16Verifier.sol
# 应该包含 contract Groth16Verifier

# 4. 验证 zkey 完整性
npx snarkjs zkey verify build\identity_commitment\identity_commitment.r1cs params\pot15_final.ptau build\identity_commitment\identity_commitment_final.zkey
```

### 所有电路验证

```powershell
# 检查所有 zkey 文件
Get-ChildItem "build\*\*_final.zkey" | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,1)}}

# 检查所有 vkey 文件
Get-ChildItem "build\*\vkey.json" | Select-Object Name, @{Name="Size(KB)";Expression={[math]::Round($_.Length/1KB,1)}}
```

---

## 📝 下一步行动

### 立即行动

1. ⏳ **等待当前电路完成**
   - `identity_commitment` 正在执行 Groth16 Setup
   - 预计还需 5-15 分钟

2. 📊 **监控进度**
   - 使用上面的监控脚本
   - 或查看 Terminal 17 的输出

### 完成后行动

1. ✅ 验证 `identity_commitment` 的 zkey 和 vkey
2. 📋 执行下一个电路：`reputation_verifier`
3. 📋 依次执行其他电路
4. 📋 所有电路完成后，重新编译 `anti_sybil_verifier`
5. 📋 重新执行 `anti_sybil_verifier` Trusted Setup
6. 📋 部署合约

---

## 💡 优化建议

### 1. 并行执行（高级）

如果有多个 CPU 核心，可以并行执行：

```powershell
# Terminal 1
node scripts/zk-setup-fast.mjs reputation_verifier

# Terminal 2（新窗口）
node scripts/zk-setup-fast.mjs identity_commitment

# Terminal 3（新窗口）
node scripts/zk-setup-fast.mjs privacy_payment
```

**注意**: 确保内存充足（每个进程 ~2GB）

### 2. 夜间执行

对于大电路，可以在夜间执行：

```powershell
# 晚上执行，早上检查
node scripts/zk-setup-all-fast.mjs
```

### 3. 使用 Plonk（可选）

如果 Groth16 太慢，可以考虑 Plonk：

```powershell
# Plonk 不需要 Trusted Setup
npx snarkjs plonk setup build\identity_commitment\identity_commitment.r1cs params\pot15_final.ptau build\identity_commitment\plonk.zkey
```

**优点**: 只需要一次 setup，适用于所有电路  
**缺点**: 证明大小稍大，验证 Gas 稍高

---

**文档创建时间**: 2026-04-11  
**当前状态**: `identity_commitment` Trusted Setup 进行中  
**预计完成时间**: 5-15 分钟
