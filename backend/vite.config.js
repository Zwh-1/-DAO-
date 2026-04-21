import { defineConfig } from "vite";

/** 与 package.json dependencies 对齐：原生/大体量依赖保持 external，由 node_modules 在运行时解析 */
const runtimeExternals = [
  "mysql2",
  "pg",
  "cors",
  "express",
  "ethers",
  "snarkjs",
  "circomlibjs",
  "@zk-kit/incremental-merkle-tree",
];

export default defineConfig({
  publicDir: false,
  build: {
    /** 相对项目根（yarn build 时 cwd 须为 backend/） */
    ssr: "src/server.js",
    outDir: "dist",
    emptyOutDir: true,
    target: "node20",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: runtimeExternals,
      output: {
        format: "es",
        entryFileNames: "server.js",
      },
    },
  },
});
