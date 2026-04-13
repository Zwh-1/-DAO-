/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true
  },

  // 将服务器端环境变量暴露给浏览器端
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3010",
  },

  // 开发环境代理：将 /v1 请求转发到后端，避免 CORS 跨域问题
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://localhost:3010/v1/:path*', // 代理到后端服务
      },
    ];
  },

  // Webpack 配置：忽略系统文件，解决 Windows 下 Watchpack 扫描错误
  webpack: (config, { isServer, dev }) => {
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
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },

  // 生产构建输出独立模式，兼容 Docker
  output: "standalone",
};

export default nextConfig;
