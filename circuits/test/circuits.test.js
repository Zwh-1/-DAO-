import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wasm as wasm_tester } from "circom_tester";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// circom_tester 默认调用 PATH 中的 `circom`；本地用 circom2 代理
const localBin = path.join(root, "bin");
process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH}`;
process.env.CIRCOM = "npx circom2";  // 直接使用 npx circom2

// Windows 修复：circom2 无法处理临时目录路径，直接使用项目根目录
const useProjectRoot = true;

function copyTreeToAsciiTmp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trustaid-cir-"));
  fs.mkdirSync(path.join(tmp, "node_modules"), { recursive: true });
  fs.cpSync(path.join(root, "src"), path.join(tmp, "src"), { recursive: true });
  fs.cpSync(path.join(root, "node_modules", "circomlib"), path.join(tmp, "node_modules", "circomlib"), {
    recursive: true
  });
  return tmp;
}

// Windows 部分环境下 circom2 原生进程可能不稳定；CI/Linux 或设置 RUN_CIRCOM_TESTS=1 时启用。
const runHeavy = process.env.RUN_CIRCOM_TESTS === "1";

(runHeavy ? describe : describe.skip)("TrustAid circuits (phase 5)", function () {
  this.timeout(120000);

  let testRoot;
  before(function () {
    // Windows 修复：直接使用项目根目录
    testRoot = useProjectRoot ? root : copyTreeToAsciiTmp();
  });

  after(function () {
    // Windows 修复：不删除项目根目录
    if (!useProjectRoot) {
      try {
        if (testRoot) fs.rmSync(testRoot, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("identity_commitment: constraints pass", async function () {
    const circuit = await wasm_tester(path.join(testRoot, "src/identity_commitment.circom"));
    const witness = await circuit.calculateWitness({
      social_id_hash: "100",
      secret: "200",
      trapdoor: "300"
    });
    await circuit.checkConstraints(witness);
  });

  it("anti_sybil_verifier: compiles (完整 witness 需链下构造 Merkle)", async function () {
    await wasm_tester(path.join(testRoot, "src/anti_sybil_verifier.circom"));
  });
});
