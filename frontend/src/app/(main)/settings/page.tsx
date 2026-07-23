"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const PROVIDER_PRESETS: Record<string, { host: string; port: number; label: string }> = {
  GMAIL: { host: "imap.gmail.com", port: 993, label: "Gmail" },
  OUTLOOK: { host: "outlook.office365.com", port: 993, label: "Outlook / Office 365" },
  QQ: { host: "imap.qq.com", port: 993, label: "QQ 邮箱" },
  "163": { host: "imap.163.com", port: 993, label: "163 邮箱" },
  ALIYUN: { host: "imap.aliyun.com", port: 993, label: "阿里邮箱" },
  CUSTOM: { host: "", port: 993, label: "自定义 IMAP" },
};

export default function SettingsPage() {
  const [showAddMailbox, setShowAddMailbox] = useState(false);
  const [userName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("harbor_user_name") || "" : "");

  const handleLogout = () => {
    localStorage.removeItem("harbor_refresh_token");
    localStorage.removeItem("harbor_user_name");
    window.location.href = "/login";
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
        <p className="mt-1 text-sm text-gray-500">管理账号、邮箱连接和系统配置</p>
      </div>

      {/* 个人信息 */}
      <Card>
        <CardHeader><h3 className="font-semibold">👤 个人账号</h3></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">姓名</dt>
              <dd className="font-medium">{userName || "-"}</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">版本</dt>
              <dd className="font-medium">Harbor v0.1.0</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* 邮箱连接 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">📧 邮箱连接</h3>
            <Button size="sm" onClick={() => setShowAddMailbox(true)}>+ 添加邮箱</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            连接邮箱后，邮件会自动同步到收件箱。系统不会在后台自动读取私人通讯，仅同步你指定的文件夹。
          </p>
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            <p className="font-medium mb-2">支持以下邮箱：</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                <p key={k}>• {v.label} ({v.host}:{v.port})</p>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              QQ邮箱/163邮箱请使用<strong>授权码</strong>而非登录密码。Gmail 需开启 IMAP 并使用应用专用密码。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 提醒引擎 */}
      <Card>
        <CardHeader><h3 className="font-semibold">🔔 提醒引擎</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            提醒引擎自动从邮件、案件、文件中提取截止日期和待办事项，生成提醒。所有提醒需要人工确认才会执行。
          </p>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>• 邮件到达 → AI 分析 → 生成提醒建议 → 人工确认</p>
            <p>• 案件截止 → 自动提醒 → 可推迟/完成/取消</p>
            <p>• 文件到期 → 自动提醒 → 关联案件</p>
          </div>
        </CardContent>
      </Card>

      {/* 隐私声明 */}
      <Card>
        <CardHeader><h3 className="font-semibold">🔒 隐私与安全</h3></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✅ 系统<strong>不会</strong>监听电话、监控微信、读取私人聊天</li>
            <li>✅ 系统<strong>不会</strong>自动发送邮件</li>
            <li>✅ 系统<strong>不会</strong>在后台自动收集数据</li>
            <li>✅ 所有 AI 建议需要人工确认才会执行</li>
            <li>✅ 所有操作记录在审计日志中</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <p className="text-xs text-gray-400 self-end">Harbor v0.1.0 · 报关AI操作系统</p>
        <Button variant="destructive" onClick={handleLogout}>退出登录</Button>
      </div>

      {/* 添加邮箱弹窗 */}
      {showAddMailbox && <AddMailboxModal onClose={() => setShowAddMailbox(false)} />}
    </div>
  );
}

function AddMailboxModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState("QQ");
  const [host, setHost] = useState(PROVIDER_PRESETS.QQ.host);
  const [port, setPort] = useState(PROVIDER_PRESETS.QQ.port);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  const handleProviderChange = (p: string) => {
    setProvider(p);
    if (p !== "CUSTOM") {
      setHost(PROVIDER_PRESETS[p].host);
      setPort(PROVIDER_PRESETS[p].port);
    }
  };

  const handleSave = async () => {
    setResult("邮箱连接功能即将上线。目前请手动在收件箱中创建沟通记录来管理邮件内容。");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">添加邮箱</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">服务商</label>
            <select value={provider} onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-harbor-500 bg-white">
              {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">服务器</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-harbor-500" />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-500 mb-1">端口</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-harbor-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-harbor-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">密码/授权码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="IMAP 密码或应用授权码"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-harbor-500" />
            <p className="text-xs text-gray-400 mt-1">QQ邮箱/163邮箱请使用授权码而非登录密码。</p>
          </div>
          {result && <div className="rounded-xl bg-harbor-50 border border-harbor-100 px-4 py-2.5 text-sm text-harbor-700">{result}</div>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
