'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAllChannels, type ChannelRecord } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export function ChannelsTable() {
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllChannels();
      setChannels(data.channels);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(
        msg.includes('401') || msg.includes('403')
          ? '需要登录且具备访问权限（JWT）。支付通道列表为调试级接口。'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-steel">加载通道列表…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
          刷新
        </Button>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {!error && channels.length === 0 && (
        <p className="text-sm text-steel">暂无已登记的支付通道。开通通道后由后端记录。</p>
      )}
      {!error && channels.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100/60">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface/80 text-xs uppercase text-steel">
              <tr>
                <th className="px-4 py-3">Channel ID</th>
                <th className="px-4 py-3">参与方 1</th>
                <th className="px-4 py-3">参与方 2</th>
                <th className="px-4 py-3">总质押</th>
                <th className="px-4 py-3">Nonce</th>
                <th className="px-4 py-3">退出中</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channelId} className="border-t border-gray-100/60">
                  <td className="px-4 py-3 font-mono text-xs">{c.channelId}</td>
                  <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs">{c.participant1}</td>
                  <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs">{c.participant2}</td>
                  <td className="px-4 py-3">{c.totalDeposit}</td>
                  <td className="px-4 py-3">{c.currentNonce}</td>
                  <td className="px-4 py-3">{c.exitInitiated ? '是' : '否'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
