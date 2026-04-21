'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { listBlacklistAdmin, postGuardianBlacklist, type BlacklistEntry } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import { Button, Input } from '@/components/ui/index';

export function GuardianBlacklistPanel() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [banAddress, setBanAddress] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banMsg, setBanMsg] = useState('');
  const [banOk, setBanOk] = useState<boolean | null>(null);

  const adminHint =
    typeof window !== 'undefined' && !localStorage.getItem('adminToken')
      ? '未检测到 adminToken：黑名单列表与添加均需 Admin 鉴权。'
      : null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setListErr(null);
    try {
      const r = await listBlacklistAdmin();
      setEntries(r.entries ?? []);
    } catch (e) {
      setListErr(toUserErrorMessage(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onBan(e: FormEvent) {
    e.preventDefault();
    setBanMsg('');
    setBanOk(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(banAddress)) {
      setBanOk(false);
      setBanMsg('请输入合法的以太坊地址');
      return;
    }
    try {
      await postGuardianBlacklist({ address: banAddress, reason: banReason });
      setBanOk(true);
      setBanMsg(`地址 ${banAddress.slice(0, 8)}… 已加入黑名单`);
      setBanAddress('');
      setBanReason('');
      await refresh();
    } catch (err) {
      setBanOk(false);
      setBanMsg(toUserErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {adminHint && <p className="rounded-lg border border-alert/30 bg-alert/5 px-4 py-3 text-sm text-alert">{adminHint}</p>}

      <section className="card">
        <h2 className="section-title mb-3">添加黑名单</h2>
        <form onSubmit={onBan} className="space-y-3">
          <Input label="地址" value={banAddress} onChange={(e) => setBanAddress(e.target.value)} placeholder="0x…" />
          <Input label="原因" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          <Button type="submit" variant="danger">
            加入黑名单
          </Button>
        </form>
        {banOk !== null && <p className={`mt-3 text-sm ${banOk ? 'text-success' : 'text-alert'}`}>{banMsg}</p>}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="section-title">当前黑名单</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => refresh()}>
            刷新
          </Button>
        </div>
        {loading && <p className="text-sm text-steel">加载中…</p>}
        {listErr && <p className="text-sm text-alert">{listErr}</p>}
        {!loading && !listErr && entries.length === 0 && (
          <p className="text-sm text-steel">暂无黑名单条目。</p>
        )}
        {!loading && !listErr && entries.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-100/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface/80 text-xs uppercase text-steel">
                <tr>
                  <th className="px-4 py-3">地址（脱敏）</th>
                  <th className="px-4 py-3">原因</th>
                  <th className="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.address} className="border-t border-gray-100/60">
                    <td className="px-4 py-3 font-mono text-xs">{e.addressMasked}</td>
                    <td className="px-4 py-3">{e.reason}</td>
                    <td className="px-4 py-3 text-xs text-steel">
                      {new Date(e.bannedAt * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
