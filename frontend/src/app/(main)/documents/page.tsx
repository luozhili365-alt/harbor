"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">文件管理</h2>
        <p className="mt-1 text-sm text-gray-500">管理报关单证，上传发票、提单、装箱单等文件</p>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">📂 文件上传</h3></CardHeader>
        <CardContent>
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-sm text-gray-500 mb-2">拖拽文件到此处或点击上传</p>
            <p className="text-xs text-gray-400">支持 PDF、PNG、JPG、Excel、Word、CSV、ZIP</p>
            <button className="mt-4 rounded-xl bg-harbor-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-harbor-700">
              选择文件
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold">📋 文件列表</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 text-center py-8">连接后端后显示已上传的文件</p>
        </CardContent>
      </Card>
    </div>
  );
}
