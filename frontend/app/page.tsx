"use client";

import { useEffect, useState } from "react";

interface HealthData {
  status: string;
  usedNullifiers: number;
  onchainRelay: boolean;
  timestamp?: number;
}

interface GovStats {
  total: number;
  active: number;
  passed: number;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 ${ok ? "bg-success" : "bg-alert"}`}
    />
  );
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [govStats, setGovStats] = useState<GovStats | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      // 健康检查
      try {
        const res = await fetch("/v1/health", { cache: "no-store" });
        const data = await res.json();
        setHealth(data);
        setBackendOk(res.ok);
      } catch {
        setBackendOk(false);
      }

      // DAO 提案统计
      try {
        const res = await fetch("/v1/governance/proposals", { cache: "no-store" });
        const data = await res.json();
        const proposals: Array<{ state: string }> = data.proposals ?? [];
        setGovStats({
          total: proposals.length,
          active: proposals.filter(p => p.state === "1").length,
          passed: proposals.filter(p => p.state === "2").length,
        });
      } catch {
        // 静默失败
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="card">
        <h1 className="text-2xl font-bold text-primary">TrustAid 抗女巫空投平台</h1>
        <p className="mt-2 section-desc">
          基于零知识证明与 DAO 治理的去中心化互助协议 ·{" "}
          <span className="font-medium text-primary">隐私绝对化</span>
          ：Secret / Trapdoor 等 Witness 数据绝不离开您的设备。
        </p>
      </header>

      <section className="card">
        <h2 className="section-title mb-4">系统实时状态</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-surface/50 p-4 border border-gray-100/60">
            <div className="text-xs text-steel mb-1">后端服务</div>
            <div className={`text-sm font-semibold ${backendOk === null ? "text-steel" : backendOk ? "text-success" : "text-alert"}`}>
              {backendOk === null ? "检测中…" : backendOk ? "正常" : "离线"}
            </div>
          </div>

          <div className="rounded-2xl bg-surface/50 p-4 border border-gray-100/60">
            <div className="text-xs text-steel mb-1">已用 Nullifier</div>
            <div className="text-sm font-semibold text-primary">
              {health ? health.usedNullifiers : "—"}
            </div>
          </div>

          <div className="rounded-2xl bg-surface/50 p-4 border border-gray-100/60">
            <div className="text-xs text-steel mb-1">DAO 提案</div>
            <div className="text-sm font-semibold text-primary">
              {govStats ? `${govStats.active} 活跃 / ${govStats.total} 总` : "—"}
            </div>
          </div>

          <div className="rounded-2xl bg-surface/50 p-4 border border-gray-100/60">
            <div className="text-xs text-steel mb-1">链上转发</div>
            <div className={`text-sm font-semibold ${health?.onchainRelay ? "text-success" : "text-steel"}`}>
              {health ? (health.onchainRelay ? "已启用" : "未配置") : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title mb-3">零知识证明引擎</h2>
        <div className="flex items-center gap-5">
          <div className="privacy-shield flex-shrink-0" />
          <div className="text-sm text-steel space-y-1.5">
            <p>
              <StatusDot ok={true} />
              本地算力加密：ZK Proof 在浏览器 Web Worker 内生成
            </p>
            <p>
              <StatusDot ok={true} />
              哈希算法：电路使用 <code className="font-mono text-primary">Poseidon</code>，链上使用{" "}
              <code className="font-mono text-primary">keccak256</code>
            </p>
            <p>
              <StatusDot ok={true} />
              Nullifier 抗重放：每次申领唯一，不可追踪
            </p>
            <p className="text-xs text-primary/70 mt-2">
              本地算力加密中：您的原始身份数据绝不离端，明文不会发送至服务器
            </p>
          </div>
        </div>
      </section>

      <section className="error-banner">
        <p className="font-medium">
          🔒 AI 助手永远不会询问您的私钥或助记词。如遇索取，请立即关闭页面并举报。
        </p>
      </section>

      <section className="card">
        <h2 className="section-title mb-3">角色功能导览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-steel">
          {[
            ["理赔申请", "/claim", "提交 ZK 证明 + 链上申领"],
            ["成员中心", "/member", "SBT 画像查询 + 钱包绑定"],
            ["仲裁工作台", "/arbitrator", "Commit-Reveal 投票仲裁"],
            ["挑战者", "/challenger", "质押发起女巫挑战"],
            ["预言机", "/oracle", "多签报告 + 极速通道"],
            ["守护者", "/guardian", "熔断器 + 黑名单管理"],
            ["DAO 治理", "/dao", "加权投票 + 时间锁执行"],
          ].map(([name, href, desc]) => (
            <a
              key={href}
              href={href}
              className="flex items-start gap-4 rounded-2xl border border-gray-100/60 p-4 hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="font-semibold text-primary">{name}</div>
                <div className="text-xs mt-0.5">{desc}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
