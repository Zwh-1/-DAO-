'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOracleReportById, listOracleReports, type OracleReportSummary } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export function OracleReportsTable() {
  const [rows, setRows] = useState<OracleReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailJson, setDetailJson] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOracleReports({ page: 1, limit: 50 });
      setRows(data.reports);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function showDetail(reportId: string) {
    setDetailId(reportId);
    try {
      const r = await getOracleReportById(reportId);
      setDetailJson(JSON.stringify(r, null, 2));
    } catch (e) {
      setDetailJson(e instanceof Error ? e.message : '加载详情失败');
    }
  }

  if (loading) return <p className="text-sm text-steel">加载报告列表…</p>;
  if (error) return <p className="text-sm text-alert">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
          刷新
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-steel">暂无报告，请在预言机工作台提交。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100/60">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface/80 text-xs uppercase text-steel">
              <tr>
                <th className="px-4 py-3">报告 ID</th>
                <th className="px-4 py-3">申领 ID</th>
                <th className="px-4 py-3">签名数</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">详情</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reportId} className="border-t border-gray-100/60">
                  <td className="px-4 py-3 font-mono text-xs">{r.reportId}</td>
                  <td className="px-4 py-3">{r.claimId}</td>
                  <td className="px-4 py-3">{r.signatures}</td>
                  <td className="px-4 py-3">
                    {r.finalized ? (r.approved ? '已通过' : '已终结') : '进行中'}
                  </td>
                  <td className="px-4 py-3 text-xs text-steel">
                    {new Date(r.createdAt * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-primary underline text-xs font-semibold"
                      onClick={() => showDetail(r.reportId)}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detailId && (
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-primary">报告详情：{detailId}</h3>
          <pre className="max-h-64 overflow-auto rounded-lg bg-surface/80 p-3 text-xs">{detailJson}</pre>
        </section>
      )}
    </div>
  );
}
