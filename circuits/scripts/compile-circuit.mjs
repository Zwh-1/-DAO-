/**
 * compile-circuit.mjs
 *
 * Windows-safe circom2 wrapper.
 *
 * 背景：circom2 在其 WASI 沙箱中使用 path-browserify（仅 POSIX），
 * 在 Windows 上 fs.realpathSync 返回反斜杠路径，path-browserify 无法
 * 正确处理，导致 WASI 拒绝目录写入（ENOTCAPABLE / "previous errors were found"）。
 *
 * 修复策略：
 * 1. 拦截 realpathSync，将所有反斜杠统一转换为正斜杠。
 * 2. 将工作目录切换至项目根（circuitsRoot），并使用相对路径传给 circom2，
 *    彻底避免传递带驱动器盘符（如 C:\...）的绝对路径进入 WASI 沙箱。
 * 3. [修复: 路径引用冲突] 移除 -l relSrc（即 circuits/src/）的 include 搜索路径。
 *    该路径会与 circuits/claims/ 下的同名工具文件产生歧义，导致编译器加载错误版本。
 *    现在仅使用两个无歧义路径：
 *      '.'        → circuits/ 根目录（覆盖任何从根起始的非相对路径引用）
 *      relLib     → circomlib/circuits/（覆盖 circomlib 标准库）
 *    各 .circom 文件内的相对 include（如 ../node_modules/...、./utils/...）
 *    由 circom 编译器按文件位置直接解析，无需 -l 干预。
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// ── Node.js 版本强制检查 ───────────────────────────────────────────────────────
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`[环境错误] Node.js 版本不足：当前 v${process.versions.node}，要求 >= v18.0.0`);
  console.error(`           snarkjs/circom2 在旧版本 Node.js 下存在内存溢出与 WASM 兼容性风险`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const circuitsRoot = path.resolve(__dirname, '..');

// ── 参数解析 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const circuitName = args[0];
const withWasm = args.includes('--with-wasm');

if (!circuitName) {
  console.error('用法：node scripts/compile-circuit.mjs <circuit_name> [--with-wasm]');
  console.error('');
  console.error('选项:');
  console.error('  --with-wasm  尝试生成 WASM 文件（Windows 上可能失败）');
  console.error('');
  console.error('示例:');
  console.error('  node scripts/compile-circuit.mjs identity_commitment');
  console.error('  node scripts/compile-circuit.mjs identity_commitment --with-wasm');
  process.exit(1);
}

const libDir    = path.join(circuitsRoot, 'node_modules', 'circomlib', 'circuits');
const outputDir = path.join(circuitsRoot, 'build', circuitName);

// 搜索电路文件：src/ 优先，回退至 claims/，最后搜索 utils/
let circuitPath = path.join(circuitsRoot, 'src', `${circuitName}.circom`);
if (!fs.existsSync(circuitPath)) {
  circuitPath = path.join(circuitsRoot, 'claims', `${circuitName}.circom`);
  if (!fs.existsSync(circuitPath)) {
    // 最后尝试 utils/ 子目录
    circuitPath = path.join(circuitsRoot, 'src', 'utils', `${circuitName}.circom`);
    if (!fs.existsSync(circuitPath)) {
      console.error(`[错误] 电路文件未找到：${circuitName}.circom`);
      console.error(`       搜索路径：circuits/src/、circuits/claims/、circuits/src/utils/`);
      process.exit(1);
    }
  }
}

// 将反斜杠统一转为正斜杠（WASI 沙箱要求 POSIX 路径）
const fwd = (p) => p.replace(/\\/g, '/');

console.log('================================================================');
console.log('================================================================');
console.log(` 编译电路：${circuitName}`);
console.log('================================================================');
console.log();

// ── 创建输出目录 ──────────────────────────────────────────────────────────────
fs.mkdirSync(outputDir, { recursive: true });

// ── 清理旧产物（防止新旧混用）────────────────────────────────────────────────
// 清理目标目录中的 r1cs / sym / wasm_js
for (const dir of [outputDir]) {
  try { fs.rmSync(path.join(dir, `${circuitName}.r1cs`),  { force: true }); } catch {}
  try { fs.rmSync(path.join(dir, `${circuitName}.sym`),   { force: true }); } catch {}
  try { fs.rmSync(path.join(dir, `${circuitName}_js`),    { recursive: true, force: true }); } catch {}
}
// 清理可能残留在仓库根（circom cwd）、src/、claims/ 的旧产物
for (const srcDir of [
  circuitsRoot,
  path.join(circuitsRoot, 'src'),
  path.join(circuitsRoot, 'claims'),
]) {
  try { fs.rmSync(path.join(srcDir, `${circuitName}.r1cs`), { force: true }); } catch {}
  try { fs.rmSync(path.join(srcDir, `${circuitName}.sym`),  { force: true }); } catch {}
  try { fs.rmSync(path.join(srcDir, `${circuitName}_js`),   { recursive: true, force: true }); } catch {}
}

// ── WASI 安全补丁：拦截 realpathSync，统一正斜杠输出 ─────────────────────────
const fsPatch = new Proxy(fs, {
  get(target, prop) {
    if (prop === 'realpathSync') {
      return (...fnArgs) => fwd(target.realpathSync(...fnArgs));
    }
    return typeof target[prop] === 'function'
      ? target[prop].bind(target)
      : target[prop];
  },
});

// ── 构建 WASI preopens（以 circuitsRoot 为基准，使用相对正斜杠路径）────────────────
// 将工作目录切换至 circuitsRoot，使所有相对路径以此为基准
process.chdir(circuitsRoot);

// 关键修复：preopens 必须包含所有可能访问的路径前缀
// circom2 的 WASI 沙箱需要显式授权才能访问目录
const preopens = {
  '.': fwd(circuitsRoot),                          // 根目录
  'src': fwd(path.join(circuitsRoot, 'src')),      // src/ 目录（电路文件）
  'claims': fwd(path.join(circuitsRoot, 'claims')), // claims/ 目录
  'build': fwd(path.join(circuitsRoot, 'build')),   // build/ 目录（输出）
  'node_modules': fwd(path.join(circuitsRoot, 'node_modules')), // 依赖
  'node_modules/circomlib': fwd(path.join(circuitsRoot, 'node_modules', 'circomlib')),
  'node_modules/circomlib/circuits': fwd(path.join(circuitsRoot, 'node_modules', 'circomlib', 'circuits')),
};

// 全部使用相对正斜杠路径传给 circom2（规避 Windows 绝对路径的 ENOTCAPABLE 问题）
const relCircuit = fwd(path.relative(circuitsRoot, circuitPath));
const relLib     = fwd(path.relative(circuitsRoot, libDir));

// [修复] 移除 -l relSrc（circuits/src/），仅保留两个无歧义的 include 搜索路径：
//   '.'      → circuits/ 根目录（用于处理从根起始的非相对路径引用）
//   relLib   → circomlib/circuits/（用于 circomlib 标准组件）
//   relSrc   → src/（用于 utils/ 子目录引用）
// 各 .circom 文件内已使用正确的相对路径 include（如 ../node_modules/...、./utils/...），
// 由 circom 编译器按文件位置直接解析，不受 -l 影响，无需额外搜索路径干预。
// ── 简化方案：直接使用 child_process 调用 circom2 CLI ─────────────────────────
// 背景：circom2 的 WASI 沙箱在 Windows 上存在路径兼容性问题
// 解决方案：使用 spawn 直接调用 circom2 可执行文件（Windows 为 .cmd，Unix 为无后缀），绕过 WASI 沙箱
// 关键修复：移除 -o 参数，先生成到当前目录，再手动移动文件

import { spawn } from 'child_process';

const wasmArgs = withWasm ? ['--wasm'] : [];
const wasmNote = withWasm ? ' (含 WASM)' : '';

console.log(`[1/2] 编译电路${wasmNote}...`);

// 使用相对路径，移除 -o 参数（Windows 下 -o 无法创建嵌套目录）
const circom2Args = [
  relCircuit,
  '--r1cs',
  ...wasmArgs,
  '--sym',
  '-l', '.',
  '-l', relLib,
  '-l', 'src',  // [新增] 支持 src/ 下的 utils/ 子目录引用
];

console.log(`      circom2 ${circom2Args.join(' ')}`);
console.log('');

// Windows 使用 circom2.cmd；Linux/macOS 使用无后缀的 circom2（用 .cmd 会被 bash 当脚本解析而报错）
const circom2BinDir = path.join(circuitsRoot, 'node_modules', '.bin');
const circom2Candidates =
  process.platform === 'win32'
    ? ['circom2.cmd', 'circom2']
    : ['circom2', 'circom2.cmd'];
let circom2Path = path.join(circom2BinDir, circom2Candidates[0]);
for (const name of circom2Candidates) {
  const p = path.join(circom2BinDir, name);
  if (fs.existsSync(p)) {
    circom2Path = p;
    break;
  }
}

const child = spawn(circom2Path, circom2Args, {
  stdio: 'inherit',
  cwd: circuitsRoot,
  shell: process.platform === 'win32',
});

await new Promise((resolve) => {
  child.on('close', (code) => {
    // 非零退出码仍继续：由后续 R1CS/SYM/WASM 文件检查判定成败（含仅 WASM 失败）
    console.log(`\n[INFO] circom2 进程结束，退出码：${code}`);
    resolve();
  });
  
  child.on('error', (err) => {
    console.error(`[错误] circom2 启动失败：${err.message}`);
    resolve();
  });
});

// ── 移动文件到输出目录 ────────────────────────────────────────────────────────
console.log('[2/2] 移动文件...');

// 确保输出目录存在
fs.mkdirSync(outputDir, { recursive: true });

// circom2 的 cwd 为 circuitsRoot 时，产物写在仓库根下 ./name.r1cs（见日志 Written successfully: ./xxx）；
// 部分环境也会写在 .circom 同目录，故按顺序尝试两处再迁入 build/<name>/。
const circuitDir = path.dirname(circuitPath);
const artifactBases = [circuitsRoot, circuitDir];
const filesToMove = [
  { name: `${circuitName}.r1cs`, isDir: false },
  { name: `${circuitName}.sym`, isDir: false },
  { name: `${circuitName}_js`, isDir: true },
];

for (const { name, isDir } of filesToMove) {
  const dst = path.join(outputDir, name);
  let src = null;
  for (const base of artifactBases) {
    const p = path.join(base, name);
    if (fs.existsSync(p)) {
      src = p;
      break;
    }
  }
  if (!src) continue;
  try {
    if (isDir) {
      fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(src, dst, { recursive: true });
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      fs.renameSync(src, dst);
    }
  } catch (err) {
    console.error(`[错误] 移动产物失败 ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

// ── 验证输出文件完整性 ────────────────────────────────────────────────────────
const r1cs = path.join(outputDir, `${circuitName}.r1cs`);
const sym  = path.join(outputDir, `${circuitName}.sym`);
const wasm = path.join(outputDir, `${circuitName}_js`, `${circuitName}.wasm`);

let ok = true;

if (!fs.existsSync(r1cs)) { 
  console.error(`[错误] R1CS 缺失`); 
  ok = false; 
}

if (!fs.existsSync(sym)) { 
  console.error(`[错误] SYM 缺失`);  
  ok = false; 
}

if (withWasm && !fs.existsSync(wasm)) {
  console.error(`[错误] WASM 缺失（已传 --with-wasm）：${wasm}`);
  console.error('       常见：Windows 路径/WASI；或 Linux 误执行 circom2.cmd（须用无后缀 circom2）。');
  console.error('       建议：Windows 用英文短路径/WSL；Linux 用本仓库 compile-circuit 的平台分支并在本机 npm install。');
  ok = false;
}

if (!ok) {
  console.error('================================================================');
  console.error(' 编译失败');
  console.error('================================================================');
  process.exit(1);
}

console.log('================================================================');
console.log(` 编译成功：${circuitName}`);
console.log('================================================================');
console.log(withWasm ? ' 状态：R1CS + SYM + WASM ✓' : ' 状态：R1CS + SYM ✓');
console.log('================================================================');
if (!withWasm) {
  console.log(' 提示：需要 WASM 请添加 --with-wasm 参数');
}
console.log();
