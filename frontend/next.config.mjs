/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 后端 origin，与 NEXT_PUBLIC_BACKEND_URL、lib/api/client.ts 一致（勿尾斜杠） */
const backendOrigin = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3010"
).replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: process.env.NODE_ENV === 'production',

  transpilePackages: ['@trustaid/wallet-sdk'],

  serverExternalPackages: ['snarkjs', 'circomlibjs', 'poseidon-lite'],

  experimental: {
    externalDir: true,
    optimizePackageImports: [
      'viem',
      'ethers',
      'framer-motion',
      '@tanstack/react-query',
      'circomlibjs',
    ],
  },

  // 将服务器端环境变量暴露给浏览器端
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3010",
    NEXT_PUBLIC_DAPP_URL: process.env.NEXT_PUBLIC_DAPP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ?? "887766",
  },

  // 将浏览器侧 /v1/* 转发到后端（本地与部署均可通过 NEXT_PUBLIC_BACKEND_URL 指向真实 API）
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${backendOrigin}/v1/:path*`,
      },
    ];
  },

  /** 旧钱包路由 → 个人资料页（内含钱包组件） */
  async redirects() {
    return [
      {
        source: "/wallet",
        destination: "/member/profile",
        permanent: true,
      },
      {
        source: "/member/profile/wallet",
        destination: "/member/profile",
        permanent: true,
      },
    ];
  },

  // Webpack 配置：路径别名和系统文件忽略
  webpack: (config, { isServer, dev }) => {
    // 配置路径别名 @/
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      '@components': path.join(__dirname, 'src/components'),
      '@hooks': path.join(__dirname, 'src/hooks'),
      '@lib': path.join(__dirname, 'src/lib'),
      '@store': path.join(__dirname, 'src/store'),
      '@utils': path.join(__dirname, 'src/utils'),
      '@types': path.join(__dirname, 'src/types'),
      '@workers': path.join(__dirname, 'src/workers'),
      '@app': path.join(__dirname, 'src/app'),
    };

    if (dev && !isServer) {
      // 配置 watchOptions.ignored 忽略系统文件和目录
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          // Windows 系统文件
          '**/*.sys',
          '**/*.log.tmp',
          '**/pagefile.sys',
          '**/DumpStack.log.tmp',
          // 其他系统目录
          '**/$RECYCLE.BIN/**',
          '**/System Volume Information/**',
        ],
      };
    }

    return config;
  },

  // Web Worker 中加载 snarkjs WASM 需要的响应头
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",  value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  // 生产构建输出独立模式，兼容 Docker
  output: "standalone",
};

export default nextConfig;
