import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: '新建',
    COLLECTING_DOCUMENTS: '收集中',
    DRAFT: '草稿',
    PREPARING: '准备中',
    READY_TO_SUBMIT: '待提交',
    READY: '待提交',
    SUBMITTED: '已提交',
    UNDER_REVIEW: '审核中',
    QUERY_RAISED: '海关查询',
    INSPECTION: '查验中',
    CLEARED: '已放行',
    COMPLETED: '已结关',
    CLOSED: '已结关',
    REJECTED: '已退单',
    CANCELLED: '已取消',
    STALLED: '已停滞'
  }
  return labels[status] || status
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-600',
    DRAFT: 'bg-gray-100 text-gray-600',
    COLLECTING_DOCUMENTS: 'bg-blue-50 text-blue-700',
    PREPARING: 'bg-yellow-50 text-yellow-700',
    READY_TO_SUBMIT: 'bg-purple-50 text-purple-700',
    READY: 'bg-purple-50 text-purple-700',
    SUBMITTED: 'bg-purple-50 text-purple-700',
    UNDER_REVIEW: 'bg-orange-50 text-orange-700',
    QUERY_RAISED: 'bg-red-50 text-red-700',
    INSPECTION: 'bg-amber-50 text-amber-700',
    CLEARED: 'bg-green-50 text-green-700',
    COMPLETED: 'bg-gray-100 text-gray-500',
    CLOSED: 'bg-gray-100 text-gray-500',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-500'
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
}

export function priorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-600',
    NORMAL: 'bg-blue-50 text-blue-600',
    HIGH: 'bg-orange-50 text-orange-600',
    URGENT: 'bg-red-50 text-red-600'
  }
  return colors[priority] || 'bg-gray-100 text-gray-600'
}

export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: '低',
    NORMAL: '普通',
    HIGH: '高',
    URGENT: '紧急'
  }
  return labels[priority] || priority
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return formatDate(dateStr)
}
