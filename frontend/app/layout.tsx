import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AIChatbot from "../components/ai/AIChatbot";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";

export const metadata: Metadata = {
  title: "TrustAid 抗女巫空投系统",
  description: "基于零知识证明的隐私保护与 DAO 治理平台"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex h-screen bg-base overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto w-full p-6 md:p-10">
              {children}
            </main>
          </div>
        </div>
        <AIChatbot />
      </body>
    </html>
  );
}
