import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */

interface CommItem {
  id: string
  comm_type: string
  direction: string
  status: string
  priority: string
  from_name: string | null
  from_contact: string | null
  subject: string | null
  body_text: string | null
  snippet: string | null
  linked_case_id: string | null
  linked_client_id: string | null
  case_no: string | null
  client_name: string | null
  assigned_to_name: string | null
  ai_processed: number
  ai_summary: string | null
  ai_extracted_fields: Record<string, { value: string; confidence: number }> | null
  ai_intent: string | null
  ai_intent_confidence: number | null
  ai_suggested_actions: Array<{ action: string; label: string; params?: Record<string, unknown> }> | null
  has_attachments: number
  tags: string[] | null
  notes: string | null
  created_at: string
}

interface CommStats { unread: number; highPriority: number; aiWaiting: number }

/* ── Constants ─────────────────────────────────── */

const COMM_TYPES: Record<string, string> = {
  EMAIL: '邮件', PHONE_CALL: '电话', MEETING: '会议', WECHAT: '微信',
  DOCUMENT: '文档上传', OCR_IMPORT: 'OCR导入',
  MANUAL: '手动记录', INTERNAL_NOTE: '内部备注', OTHER: '其他'
}

const COMM_TYPE_ICONS: Record<string, string> = {
  EMAIL: '📧', PHONE_CALL: '📞', MEETING: '🤝', WECHAT: '💬',
  DOCUMENT: '📄', OCR_IMPORT: '📷', MANUAL: '📝',
  INTERNAL_NOTE: '📌', OTHER: '📎'
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '活跃' },
  { value: 'UNREAD', label: '未读' },
  { value: 'ASSIGNED', label: '已分配' },
  { value: 'WAITING', label: '等待中' },
  { value: 'FLAGGED', label: '已标记' },
  { value: 'ARCHIVED', label: '已归档' },
]

const INTENT_LABELS: Record<string, string> = {
  DOCUMENT_SUBMISSION: '文件提交', STATUS_INQUIRY: '状态查询',
  URGENT_REQUEST: '紧急请求', SHIPPING_UPDATE: '物流更新',
  INSPECTION_NOTICE: '查验通知', PAYMENT_RELATED: '付款相关',
  COMPLAINT: '投诉', DOCUMENT_CORRECTION: '文件更正', OTHER: '其他'
}

function priorityBadge(p: string) {
  switch (p) {
    case 'URGENT': return 'bg-red-50 text-red-600 border-red-100'
    case 'HIGH': return 'bg-orange-50 text-orange-600 border-orange-100'
    case 'NORMAL': return 'bg-blue-50 text-blue-600 border-blue-100'
    case 'LOW': return 'bg-gray-50 text-gray-500 border-gray-100'
    default: return 'bg-gray-50 text-gray-500'
  }
}

function priorityLabel(p: string) {
  switch (p) { case 'URGENT': return '紧急'; case 'HIGH': return '高'; case 'NORMAL': return '普通'; case 'LOW': return '低'; default: return p }
}

function confidenceColor(v: number): string {
  if (v >= 0.95) return 'text-green-600 bg-green-50'
  if (v >= 0.80) return 'text-amber-600 bg-amber-50'
  return 'text-red-500 bg-red-50'
}

function confidenceLabel(v: number): string {
  if (v >= 0.95) return '高置信度'
  if (v >= 0.80) return '需审核'
  return '需人工验证'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/* ── Main Component ────────────────────────────── */

export default function InboxPage() {
  const [items, setItems] = useState<CommItem[]>([])
  const [stats, setStats] = useState<CommStats>({ unread: 0, highPriority: 0, aiWaiting: 0 })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CommItem | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showNewComm, setShowNewComm] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = { limit: '50' }
      if (filterStatus) filters.status = filterStatus
      if (filterType) filters.comm_type = filterType
      if (filterPriority) filters.priority = filterPriority
      if (searchQuery) filters.q = searchQuery

      const result = await window.harbor.invoke<{ items: CommItem[]; total: number; stats: CommStats }>('communications:list', filters)
      setItems(result.items)
      setTotal(result.total)
      setStats(result.stats)
    } catch (err) { console.error('Failed to load inbox:', err) }
    finally { setLoading(false) }
  }, [filterStatus, filterType, filterPriority, searchQuery])

  useEffect(() => { loadItems() }, [loadItems])

  const handleSelect = async (item: CommItem) => {
    // Fetch full detail
    const detail = await window.harbor.invoke<CommItem | null>('communications:getById', item.id)
    if (detail) {
      setSelected(detail)
      // Update item in list with READ status
      setItems(prev => prev.map(i => i.id === detail.id ? { ...i, status: 'READ' } : i))
    }
  }

  const handleAnalyze = async () => {
    if (!selected) return
    setAnalyzing(true)
    try {
      const result = await window.harbor.invoke<{
        success: boolean; summary: string
        extractedFields: Record<string, { value: string; confidence: number }>
        intent: { type: string; label: string; confidence: number }
        suggestedActions: Array<{ action: string; label: string; params?: Record<string, unknown> }>
      }>('communications:analyze', selected.id)
      if (result.success) {
        setSelected({
          ...selected,
          ai_processed: 1,
          ai_summary: result.summary,
          ai_extracted_fields: result.extractedFields,
          ai_intent: result.intent.type,
          ai_intent_confidence: result.intent.confidence,
          ai_suggested_actions: result.suggestedActions,
        })
      }
    } catch (err) { console.error('AI analysis failed:', err) }
    finally { setAnalyzing(false) }
  }

  const handleAcceptSuggestion = async (action: { action: string; label: string; params?: Record<string, unknown> }) => {
    if (!selected) return
    await window.harbor.invoke('communications:acceptSuggestion', selected.id, action.action, action.params || {}, 'current')
    // Remove accepted action from list
    setSelected({
      ...selected,
      ai_suggested_actions: selected.ai_suggested_actions?.filter(a => a.action !== action.action) || null
    })
  }

  const handleRejectSuggestion = async (action: { action: string; label: string }) => {
    if (!selected) return
    await window.harbor.invoke('communications:rejectSuggestion', selected.id, action.action, 'current')
    setSelected({
      ...selected,
      ai_suggested_actions: selected.ai_suggested_actions?.filter(a => a.action !== action.action) || null
    })
  }

  const handleMarkRead = async (id: string) => {
    await window.harbor.invoke('communications:update', id, { status: 'READ' }, 'current')
    loadItems()
  }

  const handleArchive = async (id: string) => {
    await window.harbor.invoke('communications:update', id, { status: 'ARCHIVED' }, 'current')
    setSelected(null)
    loadItems()
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="w-[240px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatBadge label="未读" value={stats.unread} color="bg-harbor-50 text-harbor-700" />
          <StatBadge label="高优先" value={stats.highPriority} color="bg-red-50 text-red-600" />
          <StatBadge label="待AI" value={stats.aiWaiting} color="bg-purple-50 text-purple-600" />
        </div>

        {/* Status Filter */}
        <FilterSection title="状态">
          {STATUS_OPTIONS.map(o => (
            <FilterItem key={o.value} label={o.label} active={filterStatus === o.value}
              onClick={() => setFilterStatus(filterStatus === o.value ? '' : o.value)} />
          ))}
        </FilterSection>

        {/* Type Filter */}
        <FilterSection title="类型">
          {Object.entries(COMM_TYPES).map(([k, v]) => (
            <FilterItem key={k} label={`${COMM_TYPE_ICONS[k]} ${v}`} active={filterType === k}
              onClick={() => setFilterType(filterType === k ? '' : k)} />
          ))}
        </FilterSection>

        {/* Priority Filter */}
        <FilterSection title="优先级">
          {['URGENT', 'HIGH', 'NORMAL', 'LOW'].map(p => (
            <FilterItem key={p} label={priorityLabel(p)} active={filterPriority === p}
              onClick={() => setFilterPriority(filterPriority === p ? '' : p)} />
          ))}
        </FilterSection>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-50 bg-white">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-300">🔍</span>
            <input
              type="text" placeholder="搜索沟通记录..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[13px] outline-none focus:border-harbor-300 focus:bg-white transition-colors"
            />
          </div>
          <span className="text-[12px] text-gray-400">{total} 条记录</span>
          <button
            onClick={() => setShowNewComm(true)}
            className="shrink-0 rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-gray-800 transition-colors"
          >
            + 新建记录
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-50 p-4">
                  <div className="h-3 w-32 rounded bg-gray-100 mb-2" />
                  <div className="h-3 w-48 rounded bg-gray-50" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-5xl mb-4">📥</div>
              <h3 className="text-[15px] font-semibold text-gray-700 mb-1">收件箱为空</h3>
              <p className="text-[13px] text-gray-400 mb-4">
                手动记录电话、会议、微信等沟通信息，或等待邮件集成
              </p>
              <button
                onClick={() => setShowNewComm(true)}
                className="rounded-lg bg-harbor-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-harbor-700 transition-colors"
              >
                新建第一条记录
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <CommCard
                  key={item.id}
                  item={item}
                  active={selected?.id === item.id}
                  onClick={() => handleSelect(item)}
                  onMarkRead={() => handleMarkRead(item.id)}
                  onArchive={() => handleArchive(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL — AI Workspace ═══ */}
      <div className="w-[380px] shrink-0 overflow-y-auto bg-white">
        {selected ? (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium border', priorityBadge(selected.priority))}>
                {priorityLabel(selected.priority)}
              </span>
              <span className="text-[11px] text-gray-400">{COMM_TYPES[selected.comm_type] || selected.comm_type}</span>
            </div>

            {/* Subject & Body */}
            <div>
              <h3 className="text-[15px] font-semibold text-gray-900">{selected.subject || '(无主题)'}</h3>
              {selected.from_name && (
                <p className="text-[13px] text-gray-500 mt-1">
                  来自: {selected.from_name}{selected.from_contact ? ` <${selected.from_contact}>` : ''}
                </p>
              )}
              {selected.client_name && (
                <p className="text-[13px] text-gray-400">客户: {selected.client_name}</p>
              )}
              {selected.case_no && (
                <p className="text-[13px] text-gray-400 font-mono">案件: {selected.case_no}</p>
              )}
            </div>

            {selected.body_text && (
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {selected.body_text}
                </p>
              </div>
            )}

            {/* AI Analyze button */}
            {!selected.ai_processed ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full rounded-xl bg-gradient-to-r from-harbor-500 to-harbor-600 px-4 py-3 text-[13px] font-medium text-white hover:from-harbor-600 hover:to-harbor-700 disabled:opacity-50 transition-all shadow-sm shadow-harbor-200"
              >
                {analyzing ? '分析中...' : '🤖 AI 分析'}
              </button>
            ) : (
              <>
                {/* AI Summary */}
                {selected.ai_summary && (
                  <div className="rounded-xl bg-gradient-to-br from-harbor-50/50 to-white border border-harbor-100 p-4">
                    <p className="text-[11px] font-semibold text-harbor-600 uppercase tracking-wider mb-1.5">AI 摘要</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{selected.ai_summary}</p>
                  </div>
                )}

                {/* Extracted Fields */}
                {selected.ai_extracted_fields && Object.keys(selected.ai_extracted_fields).length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">提取信息</p>
                    <div className="space-y-2">
                      {Object.entries(selected.ai_extracted_fields).map(([field, data]) => (
                        <div key={field} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                          <div>
                            <p className="text-[11px] text-gray-400">{field}</p>
                            <p className="text-[13px] text-gray-700 font-medium">{data.value}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', confidenceColor(data.confidence))}>
                              {Math.round(data.confidence * 100)}%
                            </span>
                            <span className="text-[10px] text-gray-400">{confidenceLabel(data.confidence)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Intent Detection */}
                {selected.ai_intent && (
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">意图识别</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-gray-800">
                        {INTENT_LABELS[selected.ai_intent] || selected.ai_intent}
                      </span>
                      {selected.ai_intent_confidence != null && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', confidenceColor(selected.ai_intent_confidence))}>
                          {Math.round(selected.ai_intent_confidence * 100)}% · {confidenceLabel(selected.ai_intent_confidence)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {selected.ai_suggested_actions && selected.ai_suggested_actions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">建议操作</p>
                    <div className="space-y-2">
                      {selected.ai_suggested_actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 group hover:border-gray-200 transition-colors">
                          <span className="text-[13px] text-gray-700 flex-1">{action.label}</span>
                          <button
                            onClick={() => handleAcceptSuggestion(action)}
                            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium text-green-600 hover:bg-green-50 transition-colors"
                            title="接受"
                          >✓</button>
                          <button
                            onClick={() => handleRejectSuggestion(action)}
                            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-100 transition-colors"
                            title="忽略"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions row */}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleArchive(selected.id)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
                    归档
                  </button>
                  <button onClick={() => setSelected(null)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
                    关闭
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[14px] text-gray-400">选择一条信息查看详情</p>
            <p className="text-[12px] text-gray-300 mt-1">AI 工作区会在这里辅助你处理</p>
          </div>
        )}
      </div>

      {/* ═══ NEW COMM MODAL ═══ */}
      {showNewComm && (
        <NewCommModal onClose={() => setShowNewComm(false)} onCreated={() => { setShowNewComm(false); loadItems() }} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════ */

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('rounded-xl px-2.5 py-2 text-center', color)}>
      <p className="text-[18px] font-bold tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-1.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="text-[10px] text-gray-300">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',
        active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      )}
    >
      {label}
    </button>
  )
}

function CommCard({ item, active, onClick, onMarkRead, onArchive }: {
  item: CommItem; active: boolean; onClick: () => void
  onMarkRead: () => void; onArchive: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-5 py-3.5 cursor-pointer transition-all duration-150 group',
        active ? 'bg-harbor-50/50 border-l-2 border-l-harbor-500' : 'hover:bg-gray-50/50 border-l-2 border-l-transparent',
        item.status === 'UNREAD' ? 'bg-white' : ''
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <span className="text-lg shrink-0 mt-0.5">{COMM_TYPE_ICONS[item.comm_type] || '📎'}</span>

        <div className="min-w-0 flex-1">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-0.5">
            {item.status === 'UNREAD' && <span className="h-2 w-2 rounded-full bg-harbor-500 shrink-0" />}
            <span className={cn('text-[14px] truncate', item.status === 'UNREAD' ? 'font-semibold text-gray-900' : 'text-gray-700')}>
              {item.subject || item.from_name || '(无主题)'}
            </span>
          </div>

          {/* Second row */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.from_name && (
              <span className="text-[12px] text-gray-500">{item.from_name}</span>
            )}
            {item.client_name && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[12px] text-gray-400">{item.client_name}</span>
              </>
            )}
            {item.case_no && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[12px] text-gray-400 font-mono">{item.case_no}</span>
              </>
            )}
          </div>

          {/* Third row */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-gray-400">{COMM_TYPES[item.comm_type]}</span>
            <span className="text-gray-200">·</span>
            {item.priority !== 'NORMAL' && (
              <>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', priorityBadge(item.priority))}>
                  {priorityLabel(item.priority)}
                </span>
                <span className="text-gray-200">·</span>
              </>
            )}
            <span className="text-[11px] text-gray-400">{timeAgo(item.created_at)}</span>
            {item.ai_processed ? (
              <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600">AI 已分析</span>
            ) : null}
          </div>
        </div>

        {/* Hover actions */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          {item.status === 'UNREAD' && (
            <button onClick={e => { e.stopPropagation(); onMarkRead() }}
              className="rounded p-1 text-xs text-gray-400 hover:text-harbor-600 hover:bg-gray-100" title="标为已读">
              ✓
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onArchive() }}
            className="rounded p-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="归档">
            📦
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── NewCommModal ──────────────────────────────── */

function NewCommModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [commType, setCommType] = useState('MANUAL')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromContact, setFromContact] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!subject.trim() && !bodyText.trim()) return
    setSaving(true)
    try {
      await window.harbor.invoke('communications:create', 'current', {
        comm_type: commType,
        subject: subject.trim() || undefined,
        body_text: bodyText.trim() || undefined,
        from_name: fromName.trim() || undefined,
        from_contact: fromContact.trim() || undefined,
        priority,
      })
      onCreated()
    } catch (err) { console.error('Failed to create:', err) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">新建沟通记录</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">类型</label>
              <select value={commType} onChange={e => setCommType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white">
                {Object.entries(COMM_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{COMM_TYPE_ICONS[k]} {v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">优先级</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white">
                <option value="LOW">低</option>
                <option value="NORMAL">普通</option>
                <option value="HIGH">高</option>
                <option value="URGENT">紧急</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">来自</label>
            <div className="flex gap-2">
              <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
                placeholder="姓名" className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
              <input type="text" value={fromContact} onChange={e => setFromContact(e.target.value)}
                placeholder="联系方式" className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
            </div>
          </div>

          <div>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="主题" autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-harbor-500 placeholder:text-gray-300" />
          </div>

          <div>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
              placeholder="沟通内容..." rows={5}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-harbor-500 placeholder:text-gray-300 resize-none" />
          </div>

          <button onClick={handleSave} disabled={saving || (!subject.trim() && !bodyText.trim())}
            className="w-full rounded-xl bg-gray-900 py-3 text-[14px] font-medium text-white hover:bg-gray-800 disabled:opacity-40 transition-all">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
