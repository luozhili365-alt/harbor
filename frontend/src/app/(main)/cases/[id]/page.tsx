"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPut, apiPost, apiUpload, apiDelete } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";

interface CaseItem {
  id: string;
  sequence_no: number;
  product_name: string;
  product_name_en: string | null;
  brand: string | null;
  model: string | null;
  hs_code: string | null;
  hs_code_confidence: number | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  duty_rate: number | null;
  vat_rate: number | null;
  country_of_origin: string | null;
}

interface CaseDetail {
  id: string;
  case_no: string;
  type: string;
  status: string;
  client: { id: string; company_name: string } | null;
  assigned_to: string | null;
  supervision_mode: string | null;
  transaction_method: string | null;
  transport_mode: string | null;
  port_of_entry: string | null;
  country_of_origin: string | null;
  declared_currency: string;
  declared_value: number | null;
  freight_amount: number | null;
  duties_estimated: number | null;
  vat_estimated: number | null;
  bill_of_lading: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  container_numbers: string[] | null;
  estimated_arrival: string | null;
  priority: string;
  declaration_number: string | null;
  internal_notes: string | null;
  deadline_date: string | null;
  items: CaseItem[];
  created_at: string;
  updated_at: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["DOCUMENTS_COLLECTING", "READY", "CANCELLED"],
  DOCUMENTS_COLLECTING: ["READY", "DRAFT", "CANCELLED"],
  READY: ["SUBMITTED", "DRAFT", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["QUERY_RAISED", "INSPECTION", "CLEARED", "REJECTED"],
  QUERY_RAISED: ["AMENDMENT_NEEDED", "UNDER_REVIEW"],
  AMENDMENT_NEEDED: ["UNDER_REVIEW", "READY"],
  INSPECTION: ["CLEARED", "QUERY_RAISED"],
  CLEARED: ["CLOSED"],
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  DOCUMENTS_COLLECTING: "收集中",
  READY: "待提交",
  SUBMITTED: "已提交",
  UNDER_REVIEW: "审核中",
  QUERY_RAISED: "海关查询",
  AMENDMENT_NEEDED: "需修改",
  INSPECTION: "查验中",
  CLEARED: "已放行",
  CLOSED: "已结关",
  REJECTED: "已退单",
  CANCELLED: "已取消",
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "docs" | "emails" | "timeline">("info");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [caseResult, tlResult] = await Promise.all([
          apiGet(`/cases/${id}`),
          apiGet(`/cases/${id}/timeline`, { limit: "50" }),
        ]);
        setCaseData(caseResult);
        setTimeline(tlResult.items || []);
      } catch (err) {
        console.error("Failed to load case:", err);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const loadDocuments = async () => {
    try {
      const data = await apiGet("/documents", { case_id: id, limit: "50" });
      setDocuments(data.items || []);
    } catch (err) { console.error(err); }
  };

  const loadEmails = async () => {
    try {
      const data = await apiGet("/emails", { case_id: id, limit: "50" });
      setEmails(data.items || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === "docs") loadDocuments();
    if (activeTab === "emails") loadEmails();
  }, [activeTab, id]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await apiPut(`/cases/${id}/status`, { status: newStatus });
      setCaseData(updated);
      // Reload timeline
      const tlResult = await apiGet(`/cases/${id}/timeline`, { limit: "50" });
      setTimeline(tlResult.items || []);
    } catch (err: any) {
      alert(err.message || "状态变更失败");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("case_id", id);
      formData.append("doc_type", "OTHER");
      await apiUpload("/documents/upload", formData);
      await loadDocuments();
    } catch (err: any) {
      alert("上传失败: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">案件不存在</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/cases")}>
          返回案件列表
        </Button>
      </div>
    );
  }

  const c = caseData;
  const transitions = VALID_TRANSITIONS[c.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cases")} className="text-gray-400 hover:text-gray-600">
              ←
            </button>
            <h2 className="text-2xl font-bold text-gray-900 font-mono">{c.case_no}</h2>
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
          </div>
          <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
            <span>客户: {c.client?.company_name || "-"}</span>
            <span>类型: {c.type === "IMPORT" ? "进口" : "出口"}</span>
            {c.bill_of_lading && <span>提单号: {c.bill_of_lading}</span>}
            {c.deadline_date && <span>截止: {new Date(c.deadline_date).toLocaleDateString("zh-CN")}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {transitions.map((ts) => (
            <Button
              key={ts}
              variant={ts === "CANCELLED" ? "destructive" : "default"}
              size="sm"
              onClick={() => handleStatusChange(ts)}
            >
              → {STATUS_LABELS[ts] || ts}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["info", "docs", "emails", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-harbor-600 text-harbor-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "info" && "📋 案件信息"}
            {tab === "docs" && `📎 文件 (${documents.length})`}
            {tab === "emails" && `📧 邮件 (${emails.length})`}
            {tab === "timeline" && "📜 时间线"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Case Info */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader><h3 className="font-semibold">商品明细</h3></CardHeader>
              <CardContent>
                {c.items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">暂无商品项</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">商品名称</th>
                        <th className="py-2 pr-2">HS编码</th>
                        <th className="py-2 pr-2">数量</th>
                        <th className="py-2 pr-2">单价</th>
                        <th className="py-2 pr-2">总价</th>
                        <th className="py-2 pr-2">原产国</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2 pr-2 text-gray-400">{item.sequence_no}</td>
                          <td className="py-2 pr-2">
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            {item.brand && <p className="text-xs text-gray-400">{item.brand} {item.model || ""}</p>}
                          </td>
                          <td className="py-2 pr-2">
                            {item.hs_code ? (
                              <span className="font-mono text-xs">
                                {item.hs_code}
                                {item.hs_code_confidence != null && (
                                  <span className={`ml-1 ${
                                    item.hs_code_confidence > 0.8 ? "text-green-500" : "text-yellow-500"
                                  }`}>
                                    {Math.round(item.hs_code_confidence * 100)}%
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">{item.quantity} {item.unit || ""}</td>
                          <td className="py-2 pr-2">{formatCurrency(item.unit_price, item.currency)}</td>
                          <td className="py-2 pr-2 font-medium">{formatCurrency(item.total_price, item.currency)}</td>
                          <td className="py-2 pr-2 text-gray-500">{item.country_of_origin || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold">内部备注</h3></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {c.internal_notes || "暂无备注"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Key Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold text-sm">基本信息</h3></CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <InfoRow label="监管方式" value={c.supervision_mode || "-"} />
                  <InfoRow label="成交方式" value={c.transaction_method || "-"} />
                  <InfoRow label="运输方式" value={c.transport_mode || "-"} />
                  <InfoRow label="进境关别" value={c.port_of_entry || "-"} />
                  <InfoRow label="原产国" value={c.country_of_origin || "-"} />
                  <InfoRow label="船名/航次" value={c.vessel_name && c.voyage_number ? `${c.vessel_name} / ${c.voyage_number}` : "-"} />
                  <InfoRow label="集装箱号" value={c.container_numbers?.join(", ") || "-"} />
                  <InfoRow label="预计到港" value={c.estimated_arrival ? new Date(c.estimated_arrival).toLocaleDateString("zh-CN") : "-"} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-sm">财务信息</h3></CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <InfoRow label="申报金额" value={formatCurrency(c.declared_value, c.declared_currency)} />
                  <InfoRow label="运费" value={formatCurrency(c.freight_amount, c.declared_currency)} />
                  <InfoRow label="预估关税" value={formatCurrency(c.duties_estimated, "CNY")} />
                  <InfoRow label="预估增值税" value={formatCurrency(c.vat_estimated, "CNY")} />
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "docs" && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">文件列表</h3>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" disabled={uploading}>
                {uploading ? "上传中..." : "📤 上传文件"}
              </Button>
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无文件</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getDocIcon(doc.doc_type)}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.original_name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.doc_type} · {doc.is_verified ? "✅ 已验证" : "⏳ 待验证"}
                          {doc.extracted_data && " · ⚡AI已提取"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/api/v1/documents/${doc.id}/preview`)}>
                        预览
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/api/v1/documents/${doc.id}/download`)}>
                        下载
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "emails" && (
        <Card>
          <CardContent>
            {emails.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无关联邮件</p>
            ) : (
              <div className="space-y-2">
                {emails.map((email: any) => (
                  <div key={email.id} className="rounded-lg border px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {email.subject || "(无主题)"}
                      </p>
                      <span className="text-xs text-gray-400">
                        {new Date(email.received_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      来自: {email.from_name || email.from_addr}
                      {email.ai_category && (
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">
                          ⚡{email.ai_category}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "timeline" && (
        <Card>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无活动记录</p>
            ) : (
              <div className="relative border-l-2 border-gray-100 ml-4">
                {timeline.map((event: any) => (
                  <div key={event.id} className="mb-4 ml-6">
                    <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-harbor-500" />
                    <p className="text-sm font-medium text-gray-900">{event.title || event.activity_type}</p>
                    {event.content && <p className="mt-1 text-sm text-gray-600">{event.content}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(event.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function getDocIcon(docType: string): string {
  const icons: Record<string, string> = {
    INVOICE: "🧾",
    PACKING_LIST: "📦",
    BILL_OF_LADING: "🚢",
    CERT_OF_ORIGIN: "📜",
    CUSTOMS_DECLARATION: "📋",
    PERMIT: "🎫",
    LICENSE: "📄",
    CONTRACT: "📝",
    CORRESPONDENCE: "✉️",
    OTHER: "📎",
  };
  return icons[docType] || "📎";
}
