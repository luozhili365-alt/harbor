"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { apiGet } from "@/lib/api";

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiGet("/search", { q, scope, limit: "10" });
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalResults = results
    ? (results.cases?.length || 0) + (results.clients?.length || 0) +
      (results.documents?.length || 0) + (results.emails?.length || 0)
    : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">智能搜索</h2>
        <p className="mt-1 text-sm text-gray-500">搜索案件、客户、文件和邮件</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索案件号、提单号、客户名称、文件内容..."
            className="w-full rounded-xl border border-gray-300 px-6 py-4 text-lg focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100"
            autoFocus
          />
        </div>
        <select value={scope} onChange={(e) => setScope(e.target.value)}
          className="rounded-xl border px-4 py-2 text-sm">
          <option value="all">全部</option>
          <option value="cases">案件</option>
          <option value="clients">客户</option>
          <option value="documents">文件</option>
          <option value="emails">邮件</option>
        </select>
        <Button onClick={handleSearch} size="lg" disabled={loading}>
          {loading ? "搜索中..." : "🔍 搜索"}
        </Button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
        </div>
      )}

      {searched && !loading && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            搜索 &quot;{q}&quot; — 找到 {totalResults} 个结果
          </p>

          {totalResults === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-400 text-lg">未找到相关结果</p>
              <p className="text-gray-400 text-sm mt-2">尝试其他关键词或扩大搜索范围</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cases */}
              {results?.cases?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 案件 ({results.cases.length})</h3>
                  <div className="space-y-2">
                    {results.cases.map((c: any) => (
                      <div key={c.id} onClick={() => router.push(`/cases/${c.id}`)}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-harbor-700">{c.case_no}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <span className="text-xs text-gray-400">{c.type === "IMPORT" ? "进口" : "出口"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clients */}
              {results?.clients?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">👥 客户 ({results.clients.length})</h3>
                  <div className="space-y-2">
                    {results.clients.map((c: any) => (
                      <div key={c.id} className="rounded-lg border px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <p className="text-sm font-medium text-gray-900">{c.company_name}</p>
                        <p className="text-xs text-gray-500">{c.contact_person || ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {results?.documents?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📎 文件 ({results.documents.length})</h3>
                  <div className="space-y-2">
                    {results.documents.map((d: any) => (
                      <div key={d.id} className="rounded-lg border px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <p className="text-sm font-medium text-gray-900">{d.original_name}</p>
                        <p className="text-xs text-gray-500">{d.doc_type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Emails */}
              {results?.emails?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📧 邮件 ({results.emails.length})</h3>
                  <div className="space-y-2">
                    {results.emails.map((e: any) => (
                      <div key={e.id} className="rounded-lg border px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <p className="text-sm font-medium text-gray-900">{e.subject || "(无主题)"}</p>
                        <p className="text-xs text-gray-500">{e.from_name || e.from_addr} · {e.received_at ? new Date(e.received_at).toLocaleDateString("zh-CN") : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
