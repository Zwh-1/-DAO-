# ============================================================
# MySQL 数据库迁移脚本（简化版）
# ============================================================

param(
    [string]$Host = "localhost",
    [string]$Port = "3306",
    [string]$User = "root",
    [string]$Password = "123456",
    [string]$Database = "trustaid_dev"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MySQL 数据库迁移工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建数据库
Write-Host "创建数据库：$Database" -ForegroundColor Cyan
$sql = "CREATE DATABASE IF NOT EXISTS \`"$Database\`" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Invoke-Expression "mysql -h$Host -P$Port -u$User -p$Password -e `"$sql`"" 2>&1 | Out-Null

# 执行迁移文件
$migrationDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @(
    "001_init.sql",
    "002_indexes.sql",
    "003_blacklist.sql",
    "004_governance.sql",
    "005_identity.sql",
    "006_anonymous_claim.sql",
    "007_channels.sql",
    "008_reputation.sql",
    "009_multisig.sql"
)

foreach ($file in $files) {
    Write-Host "执行：$file " -NoNewline
    $filePath = Join-Path $migrationDir $file
    
    # 使用 UTF8 编码读取并执行
    Get-Content $filePath -Encoding UTF8 | mysql -h$Host -P$Port -u$User -p$Password $Database 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓" -ForegroundColor Green
    } else {
        Write-Host "✗" -ForegroundColor Red
    }
}

# 验证
Write-Host ""
Write-Host "验证数据库表..." -ForegroundColor Cyan
mysql -h$Host -P$Port -u$User -p$Password -D$Database -e "SHOW TABLES;" 2>&1

Write-Host ""
Write-Host "迁移完成！" -ForegroundColor Green
