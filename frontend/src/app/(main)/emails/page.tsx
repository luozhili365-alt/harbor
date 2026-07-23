"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function EmailsPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", q: "" });
  const [selected, setSelected] = useState<any | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "30" };
      if (filter.status) params.status = filter.status;
      if (filter.q) params.q = filter.q;
      const data = await apiGet("/emails", params);
      setEmails(data.items || []);
      setTotal(data.total || 0);
      setUnread(data.unread_count || 0);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const handleSelect = async (email: any) => {
    setSelected(email);
    if (email.status === "UNREAD") {
      await apiPut(`/emails/${email.id}`, { status: "READ" });
      loadEmails();
    }
  };

  const handleLinkCase = async (emailId: string, caseId: string) => {
    await apiPut(`/emails/${emailId}/link-case?case_id=${caseId}`);
    loadEmails();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">邮件中心</h2>
          <p className="mt-1 text-sm text-gray-500">
            共 {total} 封邮件 · {unread} 封未读
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <input type="text" placeholder="搜索邮件..." value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          className="w-64 rounded-lg border px-4 py-2 text-sm" />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm">
          <option value="">全部</option>
          <option value="UNREAD">未读</option>
          <option value="READ">已读</option>
          <option value="ACTIONED">已处理</option>
          <option value="ARCHIVED">已归档</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Email List */}
        <div className="col-span-1">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
                </div>
              ) : emails.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">暂无邮件</p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => handleSelect(email)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selected?.id === email.id ? "bg-harbor-50" : ""
                      } ${email.status === "UNREAD" ? "font-semibold" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <p className={`text-sm truncate ${email.status === "UNREAD" ? "text-gray-900" : "text-gray-600"}`}>
                          {email.from_name || email.from_addr}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                          {new Date(email.received_at).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <p className={`text-sm mt-0.5 truncate ${email.status === "UNREAD" ? "text-gray-800" : "text-gray-500"}`}>
                        {email.subject || "(无主题)"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {email.ai_category && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                            ⚡{email.ai_category}
                          </span>
                        )}
                        {email.ai_priority === "HIGH" || email.ai_priority === "URGENT" ? (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
                            {email.ai_priority === "URGENT" ? "紧急" : "高优先"}
                          </span>
                        ) : null}
                        {email.status === "UNREAD" && (
                          <span className="h-2 w-2 rounded-full bg-harbor-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Detail */}
        <div className="col-span-2">
          {selected ? (
            <Card>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selected.subject || "(无主题)"}</h3>
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span>发件人: {selected.from_name || selected.from_addr} &lt;{selected.from_addr}&gt;</span>
                    <span>收件人: {selected.to_addrs?.join(", ")}</span>
                    <span>{formatDateTime(selected.received_at)}</span>
                  </div>
                  {selected.cc_addrs?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">抄送: {selected.cc_addrs.join(", ")}</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: selected.body_html || selected.body_text || "(无内容)" }} />
                </div>

                {selected.has_attachments && selected.attachment_ids?.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      📎 {selected.attachment_ids.length} 个附件
                    </p>
                  </div>
                )}

                <div className="border-t pt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => {
                    const caseId = prompt("输入案件号或案件ID:");
                    if (caseId) handleLinkCase(selected.id, caseId);
                  }}>
                    🔗 关联案件
                  </Button>
                  {selected.linked_case_id && (
                    <span className="text-sm text-green-600">
                      ✅ 已关联案件: {selected.linked_case_id}
                    </span>
                  )}
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await apiPut(`/emails/${selected.id}`, { status: "ARCHIVED" });
                    setSelected(null);
                    loadEmails();
                  }}>
                    归档
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              选择一封邮件查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
