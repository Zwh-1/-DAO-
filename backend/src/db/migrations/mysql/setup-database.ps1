# ============================================================
# MySQL 数据库迁移与配置脚本
# 自动执行数据库迁移并更新后端配置
# ============================================================

param(
    [string]$Server = "localhost",
    [string]$Port = "3306",
    [string]$User = "root",
    [string]$Password = "123456",
    [string]$Database = "trustaid_dev"
)

# 设置编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MySQL 数据库迁移与配置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 MySQL 客户端是否安装
try {
    $mysqlVersion = mysql --version 2>&1
    Write-Host "✓ MySQL 客户端已安装：$mysqlVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 错误：未找到 MySQL 客户端" -ForegroundColor Red
    Write-Host "请安装 MySQL 或下载 MySQL Shell:" -ForegroundColor Yellow
    Write-Host "https://dev.mysql.com/downloads/mysql/" -ForegroundColor Yellow
    exit 1
}

# 构建连接字符串（不含密码用于显示）
$displayConnection = "$Server`:$Port/$Database"
$fullConnection = "-h$Server -P$Port -u$User -p$Password"

# 1. 创建数据库
Write-Host ""
Write-Host "[1/4] 创建数据库..." -ForegroundColor Cyan
Write-Host "目标：$displayConnection" -ForegroundColor Gray

$createDbSql = "CREATE DATABASE IF NOT EXISTS \`"$Database\`" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h$Server -P$Port -u$User -p$Password -e "$createDbSql" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 数据库创建成功" -ForegroundColor Green
} else {
    Write-Host "✗ 数据库创建失败，请检查 MySQL 服务是否运行" -ForegroundColor Red
    exit 1
}

# 2. 获取迁移文件列表
Write-Host ""
Write-Host "[2/4] 扫描迁移文件..." -ForegroundColor Cyan
$migrationDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationFiles = Get-ChildItem -Path $migrationDir -Filter "*.sql" | 
    Where-Object { $_.Name -ne "init_database.sql" -and $_.Name -ne "verify.sql" } |
    Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "✗ 未找到迁移文件" -ForegroundColor Red
    exit 1
}

Write-Host "✓ 找到 $($migrationFiles.Count) 个迁移文件:" -ForegroundColor Green
foreach ($file in $migrationFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor Gray
}

# 3. 执行迁移
Write-Host ""
Write-Host "[3/4] 执行数据库迁移..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($file in $migrationFiles) {
    $fileName = $file.Name
    Write-Host "执行：$fileName " -NoNewline
    
    mysql -h$Server -P$Port -u$User -p$Password $Database < $file.FullName 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "✗" -ForegroundColor Red
        $failCount++
        Write-Host "  错误：执行 $fileName 失败" -ForegroundColor Red
    }
}

# 4. 验证表创建
Write-Host ""
Write-Host "[4/4] 验证数据库表..." -ForegroundColor Cyan

$tables = mysql -h$Server -P$Port -u$User -p$Password -D$Database -N -e "SHOW TABLES;" 2>$null

if ($tables.Count -gt 0) {
    Write-Host "✓ 成功创建 $($tables.Count) 张表:" -ForegroundColor Green
    $tables | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ 未找到创建的表" -ForegroundColor Red
}

# 5. 更新后端配置文件（必须与 package.json 中 --env-file=.env 一致：backend/.env）
Write-Host ""
Write-Host "更新后端配置文件..." -ForegroundColor Cyan

# $migrationDir = .../backend/src/db/migrations/mysql → 向上 4 级到 backend 根目录
$backendRoot = $migrationDir
for ($i = 0; $i -lt 4; $i++) {
    $backendRoot = Split-Path -Parent $backendRoot
}
$envFilePath = Join-Path $backendRoot ".env"

$newMySQLUrl = "DATABASE_URL=mysql://$User`:$Password@$Server`:$Port/$Database"

if (Test-Path $envFilePath) {
    $envContent = Get-Content $envFilePath -Raw -Encoding UTF8
    if ($null -eq $envContent) { $envContent = "" }

    # 替换任意已有 DATABASE_URL 行（postgresql / mysql / 其它），避免重复追加
    if ($envContent -match '(?m)^DATABASE_URL=') {
        $envContent = $envContent -replace '(?m)^DATABASE_URL=.*$', $newMySQLUrl
        Write-Host "✓ 已更新 DATABASE_URL 配置" -ForegroundColor Green
    } else {
        $trimmed = $envContent.TrimEnd()
        if ($trimmed.Length -gt 0) {
            $envContent = $trimmed + "`n" + $newMySQLUrl + "`n"
        } else {
            $envContent = $newMySQLUrl + "`n"
        }
        Write-Host "✓ 已添加 MySQL DATABASE_URL" -ForegroundColor Green
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($envFilePath, $envContent.TrimEnd("`r", "`n") + "`n", $utf8NoBom)

    Write-Host "配置文件已保存：$envFilePath" -ForegroundColor Gray
} else {
    Write-Host "⚠ 未找到 backend/.env，跳过写入 DATABASE_URL" -ForegroundColor Yellow
    Write-Host "  预期路径：$envFilePath" -ForegroundColor Gray
    Write-Host "  请将 backend/.env.example 复制为 backend/.env 后重新运行本脚本。" -ForegroundColor Yellow
}

# 6. 显示结果
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  迁移完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "成功：$successCount 个文件" -ForegroundColor Green
Write-Host "失败：$failCount 个文件" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "数据库连接字符串:" -ForegroundColor Cyan
    Write-Host "  $newMySQLUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor Cyan
    Write-Host "  1. 启动后端服务：cd backend && yarn dev" -ForegroundColor White
    Write-Host "  2. 运行测试验证：mysql -u root -p $Database < verify.sql" -ForegroundColor White
    Write-Host ""
}

Write-Host "提示：如需运行验证脚本，请执行:" -ForegroundColor Yellow
Write-Host "  mysql -u root -p $Database < verify.sql" -ForegroundColor White
Write-Host ""
