"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "仪表板", icon: "📊" },
  { href: "/cases", label: "案件管理", icon: "📋" },
  { href: "/emails", label: "邮件中心", icon: "📧" },
  { href: "/clients", label: "客户管理", icon: "👥" },
  { href: "/tasks", label: "任务提醒", icon: "✅" },
  { href: "/search", label: "智能搜索", icon: "🔍" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-harbor-600 text-white font-bold text-lg">
          H
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Harbor</h1>
          <p className="text-xs text-gray-500">报关AI助手</p>
        </div>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-harbor-50 text-harbor-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-harbor-50 text-harbor-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <span className="text-lg">⚙️</span>
          <span>系统设置</span>
        </Link>
      </div>
    </aside>
  );
}
