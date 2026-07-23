"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface CaseSummary {
  id: string;
  case_no: string;
  type: string;
  status: string;
  client_name: string;
  priority: string;
  bill_of_lading: string | null;
  deadline_date: string | null;
  assigned_to_name: string | null;
  created_at: string;
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status: string;
    type: string;
    q: string;
  }>({ status: "", type: "", q: "" });

  const loadCases = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "30" };
      if (filter.status) params.status = filter.status;
      if (filter.type) params.type = filter.type;
      if (filter.q) params.q = filter.q;
      if (cursor) params.cursor = cursor;

      const data = await apiGet("/cases", params);
      setCases(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load cases:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">案件管理</h2>
          <p className="mt-1 text-sm text-gray-500">共 {total} 个案件</p>
        </div>
        <Button onClick={() => router.push("/cases/new")}>➕ 新建案件</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="搜索案件号、提单号..."
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          className="w-64 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="DOCUMENTS_COLLECTING">收集中</option>
          <option value="READY">待提交</option>
          <option value="SUBMITTED">已提交</option>
          <option value="UNDER_REVIEW">审核中</option>
          <option value="QUERY_RAISED">海关查询</option>
          <option value="INSPECTION">查验中</option>
          <option value="CLEARED">已放行</option>
          <option value="CLOSED">已结关</option>
        </select>
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部类型</option>
          <option value="IMPORT">进口</option>
          <option value="EXPORT">出口</option>
        </select>
      </div>

      {/* Case Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-400 mb-4">暂无案件</p>
              <Button onClick={() => router.push("/cases/new")}>创建第一个案件</Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">案件号</th>
                  <th className="px-6 py-3">类型</th>
                  <th className="px-6 py-3">客户</th>
                  <th className="px-6 py-3">状态</th>
                  <th className="px-6 py-3">优先级</th>
                  <th className="px-6 py-3">提单号</th>
                  <th className="px-6 py-3">截止日期</th>
                  <th className="px-6 py-3">负责人</th>
                  <th className="px-6 py-3">创建日期</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/cases/${c.id}`)}
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-mono font-medium text-harbor-700">
                        {c.case_no}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        c.type === "IMPORT" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {c.type === "IMPORT" ? "进口" : "出口"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{c.client_name || "-"}</td>
                    <td className="px-6 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500">{c.bill_of_lading || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(c.deadline_date)}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{c.assigned_to_name || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
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
