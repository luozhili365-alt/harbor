"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    apiGet("/clients", { limit: "50", q: q || "" })
      .then((d) => { setClients(d.items || []); setTotal(d.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">客户管理</h2>
          <p className="mt-1 text-sm text-gray-500">共 {total} 个客户</p>
        </div>
        <Button onClick={() => {
          // Simple modal-like prompt for new client
          const name = prompt("客户公司名称:");
          if (name) {
            apiGet("/clients").then(() => {
              // Would use a proper create form; for now simple approach
              alert("请使用完整表单创建客户 (开发中)");
            });
          }
        }}>
          ➕ 添加客户
        </Button>
      </div>

      <input type="text" placeholder="搜索客户名称、联系人..." value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64 rounded-lg border px-4 py-2 text-sm" />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
            </div>
          ) : clients.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-400">暂无客户</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="px-6 py-3">公司名称</th>
                  <th className="px-6 py-3">联系人</th>
                  <th className="px-6 py-3">电话</th>
                  <th className="px-6 py-3">邮箱</th>
                  <th className="px-6 py-3">海关编码</th>
                  <th className="px-6 py-3">信用等级</th>
                  <th className="px-6 py-3">创建日期</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/cases?client_id=${c.id}`)}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {c.company_name}
                      {c.company_name_en && <span className="ml-2 text-xs text-gray-400">({c.company_name_en})</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.contact_person || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.contact_phone || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.contact_email || "-"}</td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500">{c.customs_code || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.customs_grade || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleDateString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
