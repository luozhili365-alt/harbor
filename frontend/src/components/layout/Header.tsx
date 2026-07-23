"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          欢迎回来，{user?.name || "..."}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/search")}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
        >
          <span>🔍</span>
          <span>搜索案件、邮件、文件...</span>
          <kbd className="ml-8 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-harbor-100 flex items-center justify-center text-harbor-700 font-medium text-sm">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-500">
              {user?.role === "admin" ? "管理员" : user?.role === "broker" ? "报关员" : "查看者"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="退出登录"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
