import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
  }).format(amount);
}

export function cnStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    DOCUMENTS_COLLECTING: "bg-blue-100 text-blue-700",
    READY: "bg-yellow-100 text-yellow-700",
    SUBMITTED: "bg-purple-100 text-purple-700",
    UNDER_REVIEW: "bg-orange-100 text-orange-700",
    QUERY_RAISED: "bg-red-100 text-red-700",
    AMENDMENT_NEEDED: "bg-pink-100 text-pink-700",
    INSPECTION: "bg-amber-100 text-amber-700",
    CLEARED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-200 text-gray-500",
    REJECTED: "bg-red-200 text-red-800",
    CANCELLED: "bg-gray-200 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

export function cnStatusLabel(status: string): string {
  const labels: Record<string, string> = {
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
  return labels[status] || status;
}

export function cnPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    NORMAL: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-600",
  };
  return colors[priority] || "bg-gray-100 text-gray-600";
}
