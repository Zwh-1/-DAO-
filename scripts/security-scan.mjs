#!/usr/bin/env node
/**
 * TrustAid 安全静态扫描
 *
 * 检查项：
 *   [HASH]    禁用 MD5/SHA-1 哈希调用
 *   [SECRET]  硬编码私钥/助记词/API Key 模式
 *   [LOG]     Witness 敏感字段泄露（secret/trapdoor console.log）
 *   [IPFS]    错误的 IPFS URI 格式（非 ipfs:// 开头）
 *   [ENV]     生产代码中直接内联 process.env.PRIVATE_KEY
 *   [ADMIN]   admin token 硬编码
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── 规则集 ─────────────────────────────────────────────────────────────────

const RULES = [
  // 禁止不安全哈希
  {
    id: "HASH-MD5",
    pattern: /createHash\(\s*["']md5["']\s*\)/i,
    severity: "HIGH",
    message: "禁止使用 MD5 哈希（违反安全基线）",
  },
  {
    id: "HASH-SHA1",
    pattern: /createHash\(\s*["']sha1["']\s*\)/i,
    severity: "HIGH",
    message: "禁止使用 SHA-1 哈希（违反安全基线）",
  },
  {
    id: "HASH-MD5-JAVA",
    pattern: /MessageDigest\.getInstance\(\s*["']MD5["']\s*\)/i,
    severity: "HIGH",
    message: "Java/Android 代码中禁止 MD5",
  },

  // 硬编码私钥模式（十六进制 64 位字符串）
  {
    id: "SECRET-PRIVKEY",
    pattern: /["'][0-9a-fA-F]{64}["']/,
    severity: "CRITICAL",
    message: "疑似硬编码的 256-bit 私钥（请使用环境变量）",
    excludePatterns: [/test|spec|mock|fixture|example/i],
  },

  // 助记词关键词（12/24 词短语）
  {
    id: "SECRET-MNEMONIC",
    pattern: /["'][a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+["']/,
    severity: "CRITICAL",
    message: "疑似硬编码助记词（12 词助记词模式）",
    excludePatterns: [/test|spec|example/i],
  },

  // Witness 字段在前端 console.log
  {
    id: "LOG-WITNESS",
    pattern: /console\.(log|warn|error|info)\s*\(.*\b(secret|trapdoor|witness|privateKey|mnemonic)\b/i,
    severity: "HIGH",
    message: "Witness 私有字段不应出现在 console 日志中",
    glob: /\.(js|ts|tsx)$/,
  },

  // 前端直接 postMessage witness 字段
  {
    id: "LOG-POSTMESSAGE",
    pattern: /postMessage\s*\(.*\b(secret|trapdoor|privateInput)\b/i,
    severity: "HIGH",
    message: "禁止将 Witness 字段通过 postMessage 发送到主线程",
    glob: /\.(js|ts)$/,
  },

  // 生产代码内联 PRIVATE_KEY 环境变量（非 .env 文件本身）
  {
    id: "ENV-PRIVKEY",
    pattern: /process\.env\.(?:PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|RELAYER_PRIVATE_KEY)/,
    severity: "MEDIUM",
    message: "确认私钥仅在部署脚本/后端中使用，禁止前端访问",
    glob: /\.(js|ts|tsx)$/,
    excludePatterns: [/scripts\/deploy|\.env|server\.js|onchain\.js|config\.js/i],
  },

  // Admin Token 硬编码
  {
    id: "ADMIN-HARDCODED",
    pattern: /admin[_-]?token\s*[:=]\s*["'][^"']{8,}["']/i,
    severity: "MEDIUM",
    message: "Admin Token 疑似硬编码（应从环境变量读取）",
    excludePatterns: [/\.example|\.env\.local/i],
  },

  // 错误 IPFS URI 格式（前端表单占位符中写了 http:// 前缀的 IPFS）
  {
    id: "IPFS-FORMAT",
    pattern: /["']https?:\/\/ipfs\./i,
    severity: "LOW",
    message: "IPFS URI 应使用 ipfs:// 格式，而非 http(s)://ipfs.",
    glob: /\.(js|ts|tsx)$/,
  },

  // 禁止 eval
  {
    id: "EVAL",
    pattern: /\beval\s*\(/,
    severity: "HIGH",
    message: "禁止使用 eval()（XSS 风险）",
    glob: /\.(js|ts|tsx)$/,
    excludePatterns: [/node_modules/i],
  },
];

// ── 文件遍历 ───────────────────────────────────────────────────────────────

const SKIP_DIRS  = new Set(["node_modules", ".git", "build", ".next", "artifacts", "cache", "dist"]);
const SOURCE_EXT = /\.(js|cjs|mjs|ts|tsx|sol|circom|java|cs)$/i;

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return files; }

  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (SOURCE_EXT.test(e.name)) files.push(p);
  }
  return files;
}

// ── 扫描 ───────────────────────────────────────────────────────────────────

const allFiles = walk(root);
const findings = [];

for (const file of allFiles) {
  const relPath = path.relative(root, file);
  let txt;
  try { txt = fs.readFileSync(file, "utf8"); }
  catch { continue; }

  for (const rule of RULES) {
    // 文件类型过滤
    if (rule.glob && !rule.glob.test(file)) continue;

    // 文件路径排除（测试/例子文件等）
    if (rule.excludePatterns?.some(ex => ex.test(relPath))) continue;

    if (rule.pattern.test(txt)) {
      // 找到具体行号
      const lines = txt.split("\n");
      const lineNums = lines
        .map((l, i) => (rule.pattern.test(l) ? i + 1 : -1))
        .filter(n => n > 0);

      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: relPath,
        lines: lineNums,
        message: rule.message,
      });
    }
  }
}

// ── 报告 ───────────────────────────────────────────────────────────────────

const SEV_COLOR = {
  CRITICAL: "\x1b[35m", // 品红
  HIGH:     "\x1b[31m", // 红
  MEDIUM:   "\x1b[33m", // 黄
  LOW:      "\x1b[36m", // 青
};
const RESET = "\x1b[0m";

if (findings.length === 0) {
  console.log(
    `\x1b[32m[OK]\x1b[0m 已扫描 ${allFiles.length} 个源文件，未发现安全问题。`
  );
  process.exit(0);
}

let hasCriticalOrHigh = false;

console.log(`\n[TrustAid Security Scan] 扫描 ${allFiles.length} 个文件，发现 ${findings.length} 处问题：\n`);

for (const f of findings) {
  const color = SEV_COLOR[f.severity] ?? "";
  console.log(`${color}[${f.severity}]${RESET} ${f.rule}`);
  console.log(`  文件：${f.file}（行 ${f.lines.join(", ")}）`);
  console.log(`  说明：${f.message}\n`);
  if (f.severity === "CRITICAL" || f.severity === "HIGH") hasCriticalOrHigh = true;
}

if (hasCriticalOrHigh) {
  console.error("\x1b[31m[FAIL] 发现 HIGH/CRITICAL 级别问题，请修复后再部署。\x1b[0m");
  process.exit(1);
} else {
  console.warn("\x1b[33m[WARN] 发现 MEDIUM/LOW 级别问题，建议修复。\x1b[0m");
  process.exit(0);
}
