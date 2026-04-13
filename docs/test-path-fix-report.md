# 测试路径问题修复报告

## 问题描述
运行 `npm test` 时，所有 23 个测试用例都失败，错误信息为：
```
Input file does not exist: C:\Users\abcta\AppData\Local\Temp\trustaid-cir-XXXXX\src\*.circom
```

## 根本原因
`circom_tester` 在 Windows 环境下存在兼容性问题：
1. `circom_tester` 需要调用 `circom` 命令行工具
2. 项目中使用的是 `circom2` npm 包（JavaScript 实现）
3. `circom_tester` 在临时目录编译电路时，无法正确找到源文件

## 已完成的修复

### 1. 创建 circom 包装脚本 ✅
**文件**: `circuits/bin/circom.cmd`
```cmd
@echo off
call "%~dp0..\node_modules\.bin\circom2.cmd" %*
```

**作用**: 将 `circom` 命令重定向到 `circom2` npm 包

**验证**:
```bash
$ .\bin\circom --version
circom2 npm package 0.2.22
circom compiler 2.2.2
```

### 2. 设置环境变量 ✅
**文件**: `circuits/test/circuits.test.js`
```javascript
const localBin = path.join(root, "bin");
process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH}`;
process.env.CIRCOM = path.join(localBin, "circom.cmd");
```

**作用**: 确保 `circom_tester` 能找到 `circom` 命令

### 3. 修复文件复制逻辑 ✅
**文件**: `circuits/test/circuits.test.js`
```javascript
function copyTreeToAsciiTmp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trustaid-cir-"));
  
  // 创建 node_modules 目录
  fs.mkdirSync(path.join(tmp, "node_modules"), { recursive: true });
  
  // 复制 src 目录（所有电路文件）
  fs.cpSync(path.join(root, "src"), path.join(tmp, "src"), { recursive: true });
  
  // 复制 circomlib（必须）- 处理 include 依赖
  const circomlibSrc = path.join(root, "node_modules", "circomlib");
  const circomlibDst = path.join(tmp, "node_modules", "circomlib");
  if (fs.existsSync(circomlibSrc)) {
    fs.cpSync(circomlibSrc, circomlibDst, { recursive: true });
  }
  
  // 复制 package.json（用于依赖解析）
  if (fs.existsSync(path.join(root, "package.json"))) {
    fs.cpSync(path.join(root, "package.json"), path.join(tmp, "package.json"));
  }
  
  // 返回正斜杠路径（circom 兼容）
  return tmp.replace(/\\/g, '/');
}
```

**作用**: 确保临时目录包含所有必要的文件

### 4. 使用正斜杠路径 ✅
**文件**: `circuits/test/circuits.test.js`
```javascript
function circuitPath(tmpDir, circuitName) {
  return `${tmpDir}/src/${circuitName}.circom`;
}
```

**作用**: 确保路径格式与 circom 兼容

## 当前问题

尽管 `circom` 命令能正常工作（`.\bin\circom --version` 成功），但 `circom_tester` 在运行时仍然报告找不到文件。

### 可能的原因

1. **circom_tester 内部实现问题**: `circom_tester` 可能在子进程中调用 circom 时没有正确继承环境变量
2. **临时目录权限问题**: Windows 可能对临时目录的访问有限制
3. **circom2 包装器问题**: `circom2.cmd` 可能无法正确处理 `circom_tester` 传递的参数

## 建议的下一步方案

### 方案 A：使用 circom 原生二进制文件（推荐）
下载并安装 circom 原生二进制文件，而不是使用 `circom2` npm 包。

**步骤**:
1. 从 GitHub Releases 下载 circom 二进制文件
2. 安装到项目 `bin` 目录
3. 替换现有的 `circom.cmd` 包装脚本

**优点**:
- 原生支持，无兼容性问题
- 性能更好

**缺点**:
- 需要额外下载和安装

### 方案 B：修改 circom_tester 配置
尝试配置 `circom_tester` 使用不同的编译方式。

**步骤**:
1. 检查 `circom_tester` 文档
2. 尝试设置 `CIRCOM_PATH` 或其他环境变量
3. 修改测试配置

### 方案 C：使用 Docker 容器运行测试
在 Linux 容器中运行测试，避免 Windows 兼容性问题。

**步骤**:
1. 创建 Dockerfile
2. 在容器中运行测试
3. 输出测试结果

**优点**:
- 完全避免 Windows 问题
- 与 CI/CD 环境一致

**缺点**:
- 需要 Docker 环境

## 当前状态

- ✅ `circom` 命令可用
- ✅ 文件复制逻辑正确
- ✅ 路径格式正确
- ❌ `circom_tester` 仍然无法找到临时文件

## 结论

当前问题似乎是 `circom_tester` 与 `circom2` npm 包在 Windows 下的兼容性问题。建议采用**方案 A**：安装 circom 原生二进制文件，或者采用**方案 C**：使用 Docker 容器运行测试。

---

**报告版本**: V1.0  
**最后更新**: 2026-04-12  
**状态**: ⚠️ **部分完成**（circom 命令已修复，但 circom_tester 兼容性问题仍需解决）
