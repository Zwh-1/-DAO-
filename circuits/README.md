# TrustAid 电路构建（含 anonymous_claim 主路径）

## 依赖

- Node.js ≥ 18  
- `npm install`（本目录）

### Linux / Ubuntu：不要用错 `yarn`

若执行 `yarn compile:all:wasm` 出现类似：

`ERROR: [Errno 2] No such file or directory: 'compile:all:wasm'`

多半是系统安装了 **`cmdtest`** 包，它在 PATH 里提供了一个**与 Node 无关的假 `yarn`**（会把脚本名当成文件路径）。**请改用本目录的 npm：**

```bash
cd circuits
npm run compile:all:wasm
```

或安装真正的 Yarn（Corepack / `npm i -g yarn`）后，确认 `which yarn` 指向 Node 工具链，而不是 `/usr/bin/yarn`（cmdtest）。不需要时可：`sudo apt remove cmdtest`（按系统提示处理依赖）。

### Linux：`circom2` 与 `circom2.cmd`

`compile-circuit.mjs` 在 **Windows** 上调 `circom2.cmd`，在 **Linux/macOS** 上调无后缀的 **`circom2`**。若在 Ubuntu 里看到对 **`circom2.cmd`** 的 `@ECHO: not found` 一类错误，说明曾用过只认 `.cmd` 的旧脚本；请更新仓库后重试。

在 **VMware `hgfs` 共享目录** 里直接 `npm install` 时，若可执行权限异常，可将 `circuits` 拷到虚拟机 **本地 ext4 目录** 再 `npm install` 与编译，更稳。

**产物位置**：`circom2` 在 `circuits/` 目录下执行时，会把 `*.r1cs`、`*.sym`、`*_js/` 写在**当前工作目录（仓库根下的 `circuits/`）**；脚本会再移动到 `build/<电路名>/`。若曾手动在 `src/` 下编译过，两处都会尝试收集。

## 编译 `anonymous_claim`

```bash
cd circuits
npm run compile:all:wasm -- anonymous_claim
```

产物目录：`build/anonymous_claim/`

- `anonymous_claim.r1cs`
- `anonymous_claim_js/anonymous_claim.wasm`（或同目录下 `.wasm`，以实际输出为准）

## 可信设置与 zkey（开发可用快速脚本）

```bash
# 编辑 scripts/zk-setup-fast.mjs 中 CONFIG.circuitName = 'anonymous_claim' 或使用项目既有批量脚本
npm run zk:setup:fast
```

期望生成：`build/anonymous_claim/anonymous_claim_final.zkey` 与验证密钥（如 `verification_key.json`）。

## 导出链上 Verifier（可选）

```bash
npm run zk:export -- anonymous_claim
```

生成 Solidity verifier 至 `contracts/` 下约定路径（以 `zk-export-verifier.mjs` 为准）。

## 前端静态资源

将 **wasm** 与 **`_final.zkey`** 复制到 Next `public` 目录（文件名与 `.env` 一致），例如：

- `frontend/public/circuits/build/anonymous_claim.wasm`
- `frontend/public/circuits/build/anonymous_claim_final.zkey`

对应环境变量（见 `frontend/.env.local.example`）：

- `NEXT_PUBLIC_ANONYMOUS_CLAIM_WASM_PATH`
- `NEXT_PUBLIC_ANONYMOUS_CLAIM_ZKEY_PATH`

**注意**：`.zkey` 含证明密钥材料，勿提交至公开仓库；生产环境使用 CI 私密注入或私有存储。

## public signals 顺序（与 `AnonymousClaim.sol` 一致）

1. `merkle_root`  
2. `nullifier`  
3. `commitment`  
4. `claim_amount`  
5. `current_timestamp`  
6. `ts_start`  
7. `ts_end`  

更完整的端到端说明见仓库 `docs/ZK申领端到端.md`。
