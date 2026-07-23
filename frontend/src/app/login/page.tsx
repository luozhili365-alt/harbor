"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const EMAIL_DOMAINS = [
  { label: "@qq.com", value: "@qq.com" },
  { label: "@163.com", value: "@163.com" },
  { label: "@126.com", value: "@126.com" },
  { label: "@gmail.com", value: "@gmail.com" },
  { label: "@outlook.com", value: "@outlook.com" },
  { label: "@hotmail.com", value: "@hotmail.com" },
  { label: "@sina.com", value: "@sina.com" },
  { label: "@aliyun.com", value: "@aliyun.com" },
  { label: "@foxmail.com", value: "@foxmail.com" },
  { label: "@yeah.net", value: "@yeah.net" },
  { label: "自定义", value: "__custom__" },
];

export default function LoginPage() {
  const [emailPrefix, setEmailPrefix] = useState("");
  const [emailDomain, setEmailDomain] = useState("@qq.com");
  const [customDomain, setCustomDomain] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const router = useRouter();

  const fullEmail = emailDomain === "__custom__"
    ? emailPrefix + customDomain
    : emailPrefix + emailDomain;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!emailPrefix.trim()) { setError("请输入邮箱地址"); return; }
    if (emailDomain === "__custom__" && !customDomain.trim()) { setError("请输入自定义邮箱域名"); return; }
    if (password.length < 1) { setError("请输入密码"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fullEmail.trim(), password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "邮箱或密码错误");
      }
      const data = await res.json();
      localStorage.setItem("harbor_token", data.access_token);
      localStorage.setItem("harbor_refresh", data.refresh_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message === "Failed to fetch" ? "无法连接服务器，请检查网络" : err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("请输入姓名"); return; }
    if (!emailPrefix.trim()) { setError("请输入邮箱地址"); return; }
    if (emailDomain === "__custom__" && !customDomain.trim()) { setError("请输入自定义邮箱域名"); return; }
    if (password.length < 6) { setError("密码至少6位"); return; }
    if (password !== confirmPassword) { setError("两次密码不一致"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fullEmail.trim(), password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "注册失败");
      }
      const data = await res.json();
      localStorage.setItem("harbor_token", data.access_token);
      localStorage.setItem("harbor_refresh", data.refresh_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message === "Failed to fetch" ? "无法连接服务器，请检查网络" : err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-harbor-600 text-white font-bold text-3xl shadow-lg">
            H
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Harbor</h1>
          <p className="mt-2 text-sm text-gray-500">报关AI操作系统</p>
        </div>

        {mode === "login" ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">登录账号</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
                <div className="flex gap-0">
                  <input type="text" value={emailPrefix} onChange={(e) => setEmailPrefix(e.target.value)}
                    className="flex-1 rounded-l-lg border border-r-0 border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="输入邮箱地址" required autoFocus />
                  {emailDomain === "__custom__" ? (
                    <input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)}
                      className="w-40 rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="@your-company.com" required />
                  ) : (
                    <select value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)}
                      className="w-36 rounded-r-lg border border-gray-300 bg-gray-50 px-2 py-2.5 text-sm text-gray-600 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100">
                      {EMAIL_DOMAINS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="输入密码" required />
              </div>
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "登录中..." : "登录"}</Button>
              <div className="flex justify-between">
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-gray-400 hover:text-harbor-600">忘记密码？</button>
                <button type="button" onClick={() => { setMode("register"); setError(""); }} className="text-xs text-harbor-600 hover:text-harbor-700">注册账号</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">注册账号</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="你的姓名" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
                <div className="flex gap-0">
                  <input type="text" value={emailPrefix} onChange={(e) => setEmailPrefix(e.target.value)}
                    className="flex-1 rounded-l-lg border border-r-0 border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="输入邮箱地址" required />
                  {emailDomain === "__custom__" ? (
                    <input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)}
                      className="w-40 rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="@your-company.com" required />
                  ) : (
                    <select value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)}
                      className="w-36 rounded-r-lg border border-gray-300 bg-gray-50 px-2 py-2.5 text-sm text-gray-600 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100">
                      {EMAIL_DOMAINS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="至少6位" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100" placeholder="再次输入密码" required />
              </div>
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "注册中..." : "注册"}</Button>
              <div className="text-center">
                <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-xs text-harbor-600 hover:text-harbor-700">已有账号？登录</button>
              </div>
            </form>
          </div>
        )}

        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">忘记密码</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">请联系管理员重置密码。如果你是唯一的账号且无法登录，需要重置数据库后重新注册。</p>
              <button onClick={() => setShowForgot(false)} className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">关闭</button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">Harbor v0.1.0</p>
      </div>
    </div>
  );
}
