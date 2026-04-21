import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AIChatbot } from "@/features/governance";
import { Sidebar, Topbar } from "@/features/governance";
import { ReactQueryProvider } from "./providers";
import { AuthProvider } from "@/components/contexts/AuthContext";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { ToastProvider } from "@/components/ui/Toast";
import dynamic from "next/dynamic";

// 动态导入钱包根 Provider（基于 @trustaid/wallet-sdk，非 wagmi 连接层）
const WalletRootProvider = dynamic(() => import("@/lib/wagmi").then((mod) => mod.WalletRootProvider), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center">Loading...</div>,
});

export const metadata: Metadata = {
  title: "TrustAID 抗女巫空投系统",
  description: "基于零知识证明的隐私保护与 DAO 治理平台"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <WalletRootProvider>
          <ReactQueryProvider>
            <AuthProvider strategy="memory">
              <AuthBootstrap />
              <ToastProvider>
                <div className="flex h-screen bg-base overflow-hidden">
                  {/* 注意：当前仍使用旧版 Sidebar/Topbar */}
                  {/* 未来可切换至新版 DashboardShell */}
                  <Sidebar />
                  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto w-full p-6 md:p-10">
                      {children}
                    </main>
                  </div>
                </div>
                <AIChatbot />
              </ToastProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </WalletRootProvider>
      </body>
    </html>
  );
}
