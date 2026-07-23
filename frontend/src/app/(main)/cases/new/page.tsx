"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/api";

export default function NewCasePage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "IMPORT",
    client_id: "",
    supervision_mode: "一般贸易",
    transaction_method: "CIF",
    transport_mode: "海运",
    port_of_entry: "",
    country_of_origin: "",
    declared_currency: "USD",
    bill_of_lading: "",
    estimated_arrival: "",
    priority: "NORMAL",
    deadline_date: "",
    internal_notes: "",
  });

  useEffect(() => {
    apiGet("/clients", { limit: "100" }).then((d) => setClients(d.items || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return alert("请选择客户");
    setLoading(true);
    try {
      const result = await apiPost("/cases", {
        ...form,
        estimated_arrival: form.estimated_arrival ? new Date(form.estimated_arrival).toISOString() : null,
        deadline_date: form.deadline_date ? new Date(form.deadline_date).toISOString() : null,
      });
      router.push(`/cases/${result.id}`);
    } catch (err: any) {
      alert("创建失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">新建案件</h2>
        <p className="mt-1 text-sm text-gray-500">创建新的报关案件</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><h3 className="font-semibold">基本信息</h3></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="进出口类型" required>
                <select value={form.type} onChange={(e) => updateField("type", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="IMPORT">进口 IMPORT</option>
                  <option value="EXPORT">出口 EXPORT</option>
                </select>
              </FormField>

              <FormField label="客户" required>
                <select value={form.client_id} onChange={(e) => updateField("client_id", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">选择客户...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="监管方式">
                <input type="text" value={form.supervision_mode}
                  onChange={(e) => updateField("supervision_mode", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </FormField>

              <FormField label="成交方式">
                <select value={form.transaction_method} onChange={(e) => updateField("transaction_method", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="FOB">FOB</option>
                  <option value="CIF">CIF</option>
                  <option value="C&F">C&F</option>
                  <option value="EXW">EXW</option>
                </select>
              </FormField>

              <FormField label="运输方式">
                <select value={form.transport_mode} onChange={(e) => updateField("transport_mode", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="海运">海运</option>
                  <option value="空运">空运</option>
                  <option value="陆运">陆运</option>
                  <option value="铁路">铁路</option>
                </select>
              </FormField>

              <FormField label="进境关别">
                <input type="text" value={form.port_of_entry} placeholder="例如: 深圳海关"
                  onChange={(e) => updateField("port_of_entry", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </FormField>

              <FormField label="原产国">
                <input type="text" value={form.country_of_origin} placeholder="例如: 日本"
                  onChange={(e) => updateField("country_of_origin", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </FormField>

              <FormField label="币制">
                <select value={form.declared_currency} onChange={(e) => updateField("declared_currency", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="USD">USD 美元</option>
                  <option value="CNY">CNY 人民币</option>
                  <option value="EUR">EUR 欧元</option>
                  <option value="JPY">JPY 日元</option>
                  <option value="HKD">HKD 港币</option>
                </select>
              </FormField>

              <FormField label="提单号">
                <input type="text" value={form.bill_of_lading}
                  onChange={(e) => updateField("bill_of_lading", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono" />
              </FormField>

              <FormField label="预计到港日期">
                <input type="date" value={form.estimated_arrival}
                  onChange={(e) => updateField("estimated_arrival", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </FormField>

              <FormField label="优先级">
                <select value={form.priority} onChange={(e) => updateField("priority", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="NORMAL">普通</option>
                  <option value="HIGH">高</option>
                  <option value="URGENT">紧急</option>
                  <option value="LOW">低</option>
                </select>
              </FormField>

              <FormField label="截止日期">
                <input type="date" value={form.deadline_date}
                  onChange={(e) => updateField("deadline_date", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </FormField>
            </div>

            <FormField label="内部备注">
              <textarea value={form.internal_notes}
                onChange={(e) => updateField("internal_notes", e.target.value)}
                rows={3} className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="可选: 内部备注信息..." />
            </FormField>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "创建中..." : "创建案件"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
