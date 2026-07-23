"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { formatDateTime, cn } from "@/lib/utils";

interface Suggestion {
  title: string; reminder_type: string; priority: string;
  due_date: string; case_id?: string; case_no?: string;
  reason: string; confidence: number;
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "PENDING" });
  const [nlInput, setNlInput] = useState("");
  const [nlCreating, setNlCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (filter.status) params.status = filter.status;
      const d = await apiGet("/tasks", params);
      setTasks(d.items || []);

      // Load AI suggestions
      const s = await apiGet("/tasks/suggestions");
      setSuggestions(s.suggestions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleComplete = async (taskId: string) => {
    await apiPut(`/tasks/${taskId}/complete`);
    load();
  };

  const handleDelete = async (taskId: string) => {
    await apiDelete(`/tasks/${taskId}`);
    load();
  };

  const acceptSuggestion = async (s: Suggestion) => {
    await apiPost("/tasks", {
      title: s.title,
      task_type: s.reminder_type,
      priority: s.priority,
      due_date: s.due_date,
      case_id: s.case_id || null,
    });
    load();
  };

  const handleNLCreate = async () => {
    if (!nlInput.trim()) return;
    setNlCreating(true);
    const text = nlInput.trim();
    let dueDate = new Date();
    if (/明天/.test(text)) dueDate.setDate(dueDate.getDate() + 1);
    else if (/后天/.test(text)) dueDate.setDate(dueDate.getDate() + 2);
    else if (/下周/.test(text)) dueDate.setDate(dueDate.getDate() + 7);
    else if (/下个月/.test(text)) dueDate.setDate(dueDate.getDate() + 30);
    else dueDate.setDate(dueDate.getDate() + 1);

    let priority = "MEDIUM";
    if (/紧急|马上|立刻/.test(text)) priority = "CRITICAL";
    else if (/重要|尽快/.test(text)) priority = "HIGH";

    let title = text.replace(/提醒我|明天|后天|下周|下个月|紧急|重要/g, "").replace(/^[，,]\s*/, "").trim();
    if (!title) title = text;

    await apiPost("/tasks", { title, priority, due_date: dueDate.toISOString(), task_type: "MANUAL" });
    setNlInput(""); setNlCreating(false); load();
  };

  const pending = tasks.filter((t: any) => t.status === "PENDING");
  const overview = tasks.filter((t: any) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const overdue = overview.filter((t: any) => new Date(t.due_date) < new Date());
  const cascades = tasks.filter((t: any) => t.task_type === "CASCADE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">提醒引擎</h2>
          <p className="mt-1 text-sm text-gray-500">
            {overview.length} 活跃 · {overdue.length} 逾期 · {cascades.length} 级联
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ 新建提醒</Button>
      </div>

      {/* Natural Language Input */}
      <div className="flex gap-2">
        <input type="text" value={nlInput} onChange={e => setNlInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleNLCreate(); }}
          placeholder='自然语言创建: "提醒我明天检查单证" 或 "紧急: 今天下午联系客户"'
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-harbor-300" />
        <button onClick={handleNLCreate} disabled={nlCreating}
          className="rounded-xl bg-harbor-600 px-5 py-3 text-sm font-medium text-white hover:bg-harbor-700 disabled:opacity-50">
          创建
        </button>
      </div>

      {/* Command Centre */}
      {!loading && overview.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="严重" value={overview.filter((t:any) => t.priority === "CRITICAL").length} color="bg-red-50 text-red-600" />
          <StatCard label="高优先级" value={overview.filter((t:any) => t.priority === "HIGH").length} color="bg-orange-50 text-orange-600" />
          <StatCard label="已逾期" value={overdue.length} color="bg-amber-50 text-amber-600" />
          <StatCard label="级联提醒" value={cascades.length} color="bg-purple-50 text-purple-600" />
        </div>
      )}

      {/* AI Suggestions */}
      {!loading && suggestions.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-sm">🤖 AI 建议 ({suggestions.length})</h3></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-harbor-100 bg-harbor-50/30 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.reason} · 置信度 {Math.round(s.confidence * 100)}%</p>
                  </div>
                  <button onClick={() => acceptSuggestion(s)}
                    className="shrink-0 rounded-lg bg-harbor-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-harbor-700">
                    ✓ 采纳
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Warning */}
      {overdue.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4">
          <p className="text-sm font-semibold text-red-600">⚠️ 已逾期 ({overdue.length})</p>
          <div className="mt-1 space-y-0.5">
            {overdue.slice(0, 3).map((t: any) => (
              <p key={t.id} className="text-xs text-red-500">• {t.title} — {formatDateTime(t.due_date)}</p>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Task List */}
      <div className="flex gap-2">
        <select value={filter.status} onChange={e => setFilter({ status: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm">
          <option value="PENDING">待处理</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="COMPLETED">已完成</option>
          <option value="CANCELLED">已取消</option>
          <option value="">全部</option>
        </select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-400">暂无提醒</p>
          <p className="text-sm text-gray-300 mt-1">用上面的自然语言输入框快速创建</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === "PENDING";
            const isCascade = task.task_type === "CASCADE";
            return (
              <div key={task.id}
                className={cn("rounded-xl border p-4 transition-colors",
                  isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-white hover:border-gray-200",
                  task.status === "COMPLETED" ? "opacity-50 bg-gray-50" : "")}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isCascade && <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">级联</span>}
                      <p className={cn("text-sm font-medium", task.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-900")}>
                        {task.title}
                      </p>
                    </div>
                    {task.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-xs text-gray-400">
                        {isOverdue ? "⚠️ 已逾期: " : "截止: "}
                        {formatDateTime(task.due_date)}
                      </span>
                      {task.case_id && <span className="text-xs text-gray-300">| 📋 关联案件</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    {task.status !== "COMPLETED" && (
                      <button onClick={() => handleComplete(task.id)}
                        className="rounded-lg p-1.5 text-green-500 hover:bg-green-50 transition-colors" title="完成">
                        ✓
                      </button>
                    )}
                    <button onClick={() => handleDelete(task.id)}
                      className="rounded-lg p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="删除">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

/* ── New Task Modal ───────────────────────────── */
function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await apiPost("/tasks", { title: title.trim(), priority, due_date: new Date(dueDate).toISOString(), task_type: "MANUAL" });
    setSaving(false); onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">新建提醒</h3>
        <div className="space-y-3">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="提醒标题" autoFocus
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-harbor-500" />
          <div className="flex gap-3">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-harbor-500" />
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-harbor-500 bg-white">
              <option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option><option value="CRITICAL">严重</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500">取消</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className={cn("rounded-xl p-3 text-center", color)}><p className="text-2xl font-bold">{value}</p><p className="text-xs opacity-70">{label}</p></div>;
}
