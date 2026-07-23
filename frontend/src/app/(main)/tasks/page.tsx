"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "PENDING" });

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: "100" };
    if (filter.status) params.status = filter.status;
    apiGet("/tasks", params)
      .then((d) => setTasks(d.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const handleComplete = async (taskId: string) => {
    await apiPut(`/tasks/${taskId}/complete`);
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: "COMPLETED" } : t));
  };

  const pending = tasks.filter((t) => t.status === "PENDING");
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const completed = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">任务看板</h2>
          <p className="mt-1 text-sm text-gray-500">
            {pending.length} 待处理 · {inProgress.length} 进行中 · {completed.length} 已完成
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value })}
            className="rounded-lg border px-3 py-2 text-sm">
            <option value="">全部</option>
            <option value="PENDING">待处理</option>
            <option value="IN_PROGRESS">进行中</option>
            <option value="COMPLETED">已完成</option>
          </select>
          <Button onClick={() => {
            const title = prompt("任务标题:");
            if (title) alert("任务创建功能开发中 - 将通过完整表单创建");
          }}>
            ➕ 新建任务
          </Button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pending */}
        <div>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm text-gray-700">
                ⏳ 待处理 ({pending.length})
              </h3>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
                </div>
              ) : pending.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-400">暂无待处理任务</p>
              ) : (
                <div className="space-y-3">
                  {pending.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete}
                      onClick={() => router.push(task.case_id ? `/cases/${task.case_id}` : "#")} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* In Progress */}
        <div>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm text-gray-700">
                🔄 进行中 ({inProgress.length})
              </h3>
            </CardHeader>
            <CardContent>
              {inProgress.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-400">暂无进行中任务</p>
              ) : (
                <div className="space-y-3">
                  {inProgress.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete}
                      onClick={() => router.push(task.case_id ? `/cases/${task.case_id}` : "#")} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Completed */}
        <div>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm text-gray-700">
                ✅ 已完成 ({completed.length})
              </h3>
            </CardHeader>
            <CardContent>
              {completed.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-400">暂无已完成任务</p>
              ) : (
                <div className="space-y-3">
                  {completed.map((task) => (
                    <div key={task.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-60">
                      <p className="text-sm text-gray-500 line-through">{task.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        完成于 {formatDateTime(task.completed_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete, onClick }: { task: any; onComplete: (id: string) => void; onClick: () => void }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className={`rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${
      isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"
    }`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <PriorityBadge priority={task.priority} />
            <span className="text-xs text-gray-400">
              {isOverdue ? "⚠️ 已逾期: " : "截止: "}
              {formatDateTime(task.due_date)}
            </span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{taskTypeLabel(task.task_type)}</span>
          </div>
        </div>
        {task.status !== "COMPLETED" && (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
            className="ml-3 rounded-full p-1 text-green-400 hover:bg-green-50 hover:text-green-600 transition-colors"
            title="标记完成"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function taskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEADLINE: "截止日", FOLLOW_UP: "跟进", DOC_REQUEST: "索文件",
    CUSTOMS_QUERY: "海关查询", REVIEW: "审核", PAYMENT: "缴税", GENERAL: "一般",
  };
  return labels[type] || type;
}
