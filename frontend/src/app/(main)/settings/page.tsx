"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
        <p className="mt-1 text-sm text-gray-500">管理账号和系统配置</p>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">个人账号</h3></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">姓名</dt>
              <dd className="font-medium">{user?.name || "-"}</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">邮箱</dt>
              <dd className="font-medium">{user?.email || "-"}</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">角色</dt>
              <dd className="font-medium">
                {user?.role === "admin" ? "管理员" : user?.role === "broker" ? "报关员" : "查看者"}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">最后登录</dt>
              <dd className="font-medium">
                {user?.last_login_at ? new Date(user.last_login_at).toLocaleString("zh-CN") : "-"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold">系统信息</h3></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">版本</dt>
              <dd className="font-medium">Harbor v0.1.0</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">环境</dt>
              <dd className="font-medium">开发环境</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">AI功能</dt>
              <dd className="font-medium text-gray-400">未启用 (需配置API密钥)</dd>
            </div>
            <div className="flex justify-between py-2 border-t">
              <dt className="text-gray-500">邮件集成</dt>
              <dd className="font-medium text-gray-400">未配置</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold">即将推出</h3></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>🤖 AI文档智能提取 — 上传发票自动识别</li>
            <li>📧 邮件自动分类 — 智能关联案件</li>
            <li>🔍 语义搜索 — 自然语言查询</li>
            <li>🔐 双因素认证</li>
            <li>📊 报表导出</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="destructive" onClick={logout}>
          退出登录
        </Button>
      </div>
    </div>
  );
}
