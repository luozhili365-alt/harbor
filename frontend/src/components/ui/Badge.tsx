import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Specialized badge for case status
export function StatusBadge({ status }: { status: string }) {
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

  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
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

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[status] || "bg-gray-100 text-gray-700"
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = {
    LOW: "低",
    NORMAL: "普通",
    HIGH: "高",
    URGENT: "紧急",
  };

  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    NORMAL: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[priority] || "bg-gray-100 text-gray-600"
      )}
    >
      {labels[priority] || priority}
    </span>
  );
}
