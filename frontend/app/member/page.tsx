"use client";

import { FormEvent, useState } from "react";
import { bindWallet, getMemberProfile } from "../../lib/api";
import { toUserErrorMessage } from "../../lib/error-map";
import { requireEthAddress, requireNonEmpty } from "../../lib/validators";
import { RoleGuard } from "../../components/auth/RoleGuard";
import { useSIWE } from "../../hooks/useSIWE";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export default function MemberPage() {
  const { address: siweAddress } = useSIWE();
  const [address, setAddress] = useState("");
  const [bindForm, setBindForm] = useState({ mainAddr: "", newAddr: "", proof: "" });
  const [result, setResult] = useState<string>("");
  const [formError, setFormError] = useState("");

  async function onGetProfile() {
    setFormError("");
    try {
      const addr = address || siweAddress || "";
      requireEthAddress(addr, "address");
      const data = await getMemberProfile(addr);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    }
  }

  async function onBind(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!siweAddress) {
      setFormError("请先连接钱包（SIWE）再进行钱包绑定");
      return;
    }
    try {
      const main = bindForm.mainAddr || siweAddress;
      requireEthAddress(main, "mainAddr");
      requireEthAddress(bindForm.newAddr, "newAddr");
      requireNonEmpty(bindForm.proof, "proof");
      const data = await bindWallet({ ...bindForm, mainAddr: main });
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    }
  }

  return (
    <RoleGuard required="member">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section className="card">
        <h1 className="text-xl font-bold text-primary">普通成员工作台</h1>
        <p className="mt-2 section-desc">支持成员画像查询和多钱包绑定（钱包绑定需登录）。</p>
      </section>

      <section className="card">
        <h2 className="mb-3 section-title">成员画像查询</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={address || siweAddress || ""}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…（留空则查询当前已连接钱包）"
            className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:w-[420px]"
          />
          <Button onClick={onGetProfile} variant="primary">
            查询画像
          </Button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 section-title">钱包绑定</h2>
        <form onSubmit={onBind} className="space-y-3">
          <Input
            label="主钱包地址"
            value={bindForm.mainAddr}
            onChange={(e) => setBindForm({ ...bindForm, mainAddr: e.target.value })}
          />
          <Input
            label="新钱包地址"
            value={bindForm.newAddr}
            onChange={(e) => setBindForm({ ...bindForm, newAddr: e.target.value })}
          />
          <Input
            label="绑定证明"
            value={bindForm.proof}
            onChange={(e) => setBindForm({ ...bindForm, proof: e.target.value })}
          />
          <Button type="submit" variant="success">
            提交绑定
          </Button>
        </form>
      </section>

      <pre className="result-pre">
        {result || "接口返回结果会显示在这里"}
      </pre>

      {formError && (
        <section className="error-banner">{formError}</section>
      )}
    </div>
    </RoleGuard>
  );
}

