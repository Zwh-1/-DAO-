# Git 自动提交与推送脚本 - PowerShell 版本
# 用法：
#   .\scripts\git-push.ps1                           # 使用默认提交信息
#   .\scripts\git-push.ps1 "feat: 添加新功能"        # 使用自定义提交信息
#   .\scripts\git-push.ps1 -Preview                  # 预览变更，不提交

param(
    [string]$Message = "chore: 代码更新",
    [switch]$Preview,
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TrustAid Git 自动提交工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目根目录
Push-Location $PROJECT_ROOT
Write-Host "项目目录：$PROJECT_ROOT" -ForegroundColor Gray
Write-Host ""

try {
    # 检查 Git 仓库
    if (-not (Test-Path ".git")) {
        Write-Host "❌ 错误：当前目录不是 Git 仓库" -ForegroundColor Red
        exit 1
    }

    # 获取 Git 状态
    Write-Host "[1/4] 检查 Git 状态..." -ForegroundColor Yellow
    $status = git status --porcelain
    $statusLines = $status -split "`n" | Where-Object { $_.Trim() -ne "" }
    
    if ($statusLines.Count -eq 0) {
        Write-Host "✅ 工作区干净，无需提交" -ForegroundColor Green
        Write-Host ""
        exit 0
    }

    Write-Host "发现 $($statusLines.Count) 个变更:" -ForegroundColor Cyan
    foreach ($line in $statusLines) {
        $statusChar = $line.Substring(0, 2)
        $file = $line.Substring(3)
        
        if ($statusChar -match "^M") {
            Write-Host "  M $file" -ForegroundColor Yellow
        } elseif ($statusChar -match "^A") {
            Write-Host "  A $file" -ForegroundColor Green
        } elseif ($statusChar -match "^D") {
            Write-Host "  D $file" -ForegroundColor Red
        } elseif ($statusChar -match "^\?\?") {
            Write-Host "  ?? $file" -ForegroundColor Cyan
        }
    }
    Write-Host ""

    # 预览模式
    if ($Preview) {
        Write-Host "👁️ 预览模式 - 未执行提交" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "提示：" -ForegroundColor Cyan
        Write-Host "  .\scripts\git-push.ps1                     # 使用默认提交信息" -ForegroundColor Gray
        Write-Host "  .\scripts\git-push.ps1 `"feat: 新功能`"     # 使用自定义提交信息" -ForegroundColor Gray
        Write-Host ""
        exit 0
    }

    # 添加所有变更
    Write-Host "[2/4] 添加文件到暂存区..." -ForegroundColor Yellow
    git add .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ git add 失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 文件已添加" -ForegroundColor Green
    Write-Host ""

    # 提交
    Write-Host "[3/4] 提交变更..." -ForegroundColor Yellow
    Write-Host "提交信息：$Message" -ForegroundColor Gray
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ git commit 失败" -ForegroundColor Red
        Write-Host "提示：可能是提交信息为空或没有变更" -ForegroundColor Gray
        exit 1
    }
    Write-Host "✅ 提交成功" -ForegroundColor Green
    Write-Host ""

    # 推送
    if (-not $NoPush) {
        Write-Host "[4/4] 推送到远程仓库..." -ForegroundColor Yellow
        
        # 先拉取最新代码
        Write-Host "  → 拉取远程代码..." -ForegroundColor Gray
        git pull --rebase origin master
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  拉取失败，可能存在冲突" -ForegroundColor Yellow
            Write-Host "提示：请手动解决冲突后运行 git push" -ForegroundColor Gray
            exit 1
        }
        
        # 推送
        git push origin master
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ git push 失败" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ 推送成功" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⏭️  跳过推送（使用 -NoPush 参数）" -ForegroundColor Cyan
        Write-Host ""
    }

    # 显示提交摘要
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ 操作完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $commitHash = git rev-parse --short HEAD
    Write-Host "提交哈希：$commitHash" -ForegroundColor Gray
    Write-Host "仓库地址：git@github.com:Zwh-1/-DAO-.git" -ForegroundColor Gray
    Write-Host ""
    Write-Host "查看历史：" -ForegroundColor Cyan
    Write-Host "  git log --oneline -5" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "❌ 发生错误：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
