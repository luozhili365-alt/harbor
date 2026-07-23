"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

interface DashboardStats {
  active_cases: number;
  unread_emails: number;
  pending_tasks: number;
  completed_this_month: number;
  overdue_tasks: number;
  cases_by_status: Record<string, number>;
}

interface DueTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  case_id: string | null;
  task_type: string;
}

interface RecentActivity {
  id: string;
  title: string;
  case_id: string;
  activity_type: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dueTasks, setDueTasks] = useState<DueTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, tasksData] = await Promise.all([
          apiGet("/dashboard/stats"),
          apiGet("/tasks/due-soon", { hours: "72", limit: "10" }),
        ]);
        setStats(statsData);
        setDueTasks(tasksData.items || []);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-harbor-200 border-t-harbor-600" />
      </div>
    );
  }

  const statCards = [
    { label: "活跃案件", value: stats?.active_cases || 0, color: "bg-blue-500", href: "/cases" },
    { label: "未读邮件", value: stats?.unread_emails || 0, color: "bg-orange-500", href: "/emails" },
    { label: "待办任务", value: stats?.pending_tasks || 0, color: "bg-purple-500", href: "/tasks" },
    { label: "本月完成", value: stats?.completed_this_month || 0, color: "bg-green-500", href: "/cases?status=CLOSED" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">仪表板</h2>
        <p className="mt-1 text-sm text-gray-500">今日工作概览</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        {statCards.map((card) => (
          <button
            key={card.label}
            onClick={() => router.push(card.href)}
            className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${card.color}`} />
              <span className="text-sm text-gray-500">{card.label}</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{card.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Upcoming Deadlines */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">⚠️ 即将到期</h3>
              <Button variant="ghost" size="sm" onClick={() => router.push("/tasks")}>
                查看全部 →
              </Button>
            </CardHeader>
            <CardContent>
              {dueTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">暂无即将到期的任务 🎉</p>
              ) : (
                <div className="space-y-2">
                  {dueTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/tasks`)}
                    >
                      <div className="flex items-center gap-3">
                        <PriorityBadge priority={task.priority} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          <p className="text-xs text-gray-500">
                            截止: {formatDateTime(task.due_date)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {getTaskTypeLabel(task.task_type)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Case Status Distribution */}
        <div>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">📊 案件状态</h3>
            </CardHeader>
            <CardContent>
              {stats?.cases_by_status && Object.keys(stats.cases_by_status).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.cases_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <StatusBadge status={status} />
                      <span className="text-sm font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-400">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button onClick={() => router.push("/cases/new")}>
          ➕ 新建案件
        </Button>
        <Button variant="outline" onClick={() => router.push("/emails")}>
          📧 查看邮件
        </Button>
        <Button variant="outline" onClick={() => router.push("/clients/new")}>
          👤 添加客户
        </Button>
      </div>
    </div>
  );
}

function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEADLINE: "截止日期",
    FOLLOW_UP: "跟进",
    DOC_REQUEST: "索取文件",
    CUSTOMS_QUERY: "海关查询",
    REVIEW: "审核",
    PAYMENT: "缴税",
    GENERAL: "一般",
  };
  return labels[type] || type;
}
