import { useEffect, useState, useCallback } from 'react'
import { formatDate, statusLabel, statusColor, priorityColor, priorityLabel, cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */

interface CaseItem {
  id: string; case_no: string; client_name: string | null; type: string
  status: string; priority: string; declared_value: number | null
  bill_of_lading: string | null; port_of_entry: string | null
  updated_at: string; deadline_date: string | null
  assigned_to_name: string | null
}

interface CaseDetail {
  id: string; case_no: string; client_name: string | null; client_id: string | null
  type: string; status: string; priority: string
  assigned_to_name: string | null; assigned_to: string | null
  supervision_mode: string | null; transaction_method: string | null
  transport_mode: string | null; port_of_entry: string | null
  port_of_departure: string | null; country_of_origin: string | null
  country_of_destination: string | null; declared_currency: string | null
  declared_value: number | null; bill_of_lading: string | null
  vessel_name: string | null; voyage_number: string | null
  container_numbers: string[] | null; estimated_arrival: string | null
  declaration_number: string | null; internal_notes: string | null
  deadline_date: string | null; created_at: string; updated_at: string
  freight_amount: number | null; insurance_amount: number | null
  assigned_team: string | null; tags: string | null
  items: CaseItemDetail[]
}

interface CaseItemDetail {
  id: string; sequence_no: number; product_name: string; product_name_en: string | null
  brand: string | null; model: string | null; hs_code: string | null
  hs_code_confidence: number | null; quantity: number | null; unit: string | null
  unit_price: number | null; total_price: number | null; currency: string | null
  duty_rate: number | null; vat_rate: number | null; country_of_origin: string | null
}

interface DocItem { id: string; filename: string; doc_type: string; storage_path: string; ocr_status: string; is_verified: number; created_at: string }
interface ChecklistItem { id: string; doc_type: string; doc_name_cn: string; tier: number; is_required: number; status: string; linked_document_id?: string }
interface CommItem { id: string; comm_type: string; subject: string | null; from_name: string | null; status: string; priority: string; created_at: string }
interface TaskItem { id: string; title: string; priority: string; status: string; due_date: string; assigned_to_name?: string }
interface ActivityItem { id: string; activity_type: string; title: string | null; user_name: string | null; created_at: string }
interface RiskItem { type: string; title: string; description: string; severity: string; confidence: number; suggested_action: string }

/* ── Constants ─────────────────────────────────── */

const STATUS_OPTIONS = ['NEW','DRAFT','COLLECTING_DOCUMENTS','PREPARING','READY','SUBMITTED','UNDER_REVIEW','CLEARED','CLOSED','CANCELLED']
const PRIORITY_OPTIONS = ['URGENT','HIGH','NORMAL','LOW']
const TABS = ['概览','文件','沟通','任务','时间线','风险','备注'] as const
type Tab = typeof TABS[number]

function typeLabel(t: string) { return t === 'IMPORT' ? '进口' : t === 'EXPORT' ? '出口' : t }
function valDisplay(v: number | null) { if (v == null) return '—'; if (v >= 10000) return `${(v/10000).toFixed(1)}万`; return v.toLocaleString() }
function severityBadge(s: string) { return s === 'HIGH' ? 'bg-red-50 text-red-600' : s === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600' }
function severityLabel(s: string) { return s === 'HIGH' ? '高' : s === 'MEDIUM' ? '中' : '低' }
function confidenceBadge(c: number) { return c >= 0.9 ? 'bg-green-50 text-green-600' : c >= 0.7 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500' }

/* ── Main Component ────────────────────────────── */

export default function CasesPage() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // List state
  const [cases, setCases] = useState<CaseItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [searchQ, setSearchQ] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const f: Record<string, string> = { limit: '50' }
      if (filterStatus) f.status = filterStatus
      if (filterPriority) f.priority = filterPriority
      if (searchQ) f.q = searchQ
      const r = await window.harbor.invoke<{ items: CaseItem[]; total: number }>('cases:list', f)
      setCases(r.items); setTotal(r.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filterStatus, filterPriority, searchQ])

  useEffect(() => { loadList() }, [loadList])

  const openDetail = (id: string) => { setSelectedId(id); setView('detail') }
  const backToList = () => { setView('list'); setSelectedId(null) }

  return (
    <div>
      {view === 'list' ? (
        <CaseListView cases={cases} total={total} loading={loading}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterPriority={filterPriority} setFilterPriority={setFilterPriority}
          searchQ={searchQ} setSearchQ={setSearchQ}
          onRefresh={loadList} onSelect={openDetail} />
      ) : (
        selectedId && <CaseDetailView caseId={selectedId} onBack={backToList} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CASE LIST VIEW
   ═══════════════════════════════════════════════════ */

function CaseListView({ cases, total, loading, filterStatus, setFilterStatus, filterPriority, setFilterPriority, searchQ, setSearchQ, onRefresh, onSelect }: {
  cases: CaseItem[]; total: number; loading: boolean
  filterStatus: string; setFilterStatus: (s: string) => void
  filterPriority: string; setFilterPriority: (s: string) => void
  searchQ: string; setSearchQ: (s: string) => void
  onRefresh: () => void; onSelect: (id: string) => void
}) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">案件列表</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">共 {total} 个案件</p>
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="rounded-lg border border-gray-200 px-3.5 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input type="text" placeholder="搜索案件号、提单号..." value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          className="w-56 rounded-xl border border-gray-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-harbor-300" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-harbor-300 bg-white">
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-harbor-300 bg-white">
          <option value="">全部优先级</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{priorityLabel(p)}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=>(
          <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-5"><div className="h-4 w-48 rounded bg-gray-100"/></div>
        ))}</div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 px-8 py-16 text-center">
          <p className="text-[15px] text-gray-400">暂无案件数据</p>
          <p className="text-[13px] text-gray-300 mt-1">创建第一个案件开始使用</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className="w-full text-left rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 hover:shadow-sm transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[14px] font-semibold text-gray-900">{c.case_no}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[13px] text-gray-500 truncate max-w-[160px]">{c.client_name || '未关联客户'}</span>
                  <span className="text-[12px] text-gray-400">{typeLabel(c.type)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.declared_value != null && <span className="text-[12px] text-gray-400">USD {valDisplay(c.declared_value)}</span>}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', priorityColor(c.priority))}>{priorityLabel(c.priority)}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor(c.status))}>{statusLabel(c.status)}</span>
                  <span className="text-[12px] text-gray-300 hidden group-hover:inline">{formatDate(c.updated_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CASE DETAIL VIEW
   ═══════════════════════════════════════════════════ */

function CaseDetailView({ caseId, onBack }: { caseId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('概览')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await window.harbor.invoke<CaseDetail | null>('cases:getById', caseId)
      setDetail(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [caseId])

  useEffect(() => { load() }, [load])

  if (loading) return <DetailSkeleton onBack={onBack} />
  if (!detail) return <div className="text-center py-16 text-gray-400">案件未找到</div>

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Back + Header */}
        <button onClick={onBack} className="text-[13px] text-gray-400 hover:text-gray-600 mb-3 transition-colors">← 返回列表</button>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[18px] font-bold text-gray-900 font-mono">{detail.case_no}</h2>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', statusColor(detail.status))}>{statusLabel(detail.status)}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', priorityColor(detail.priority))}>{priorityLabel(detail.priority)}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px] text-gray-500">
                <span>{detail.client_name || '未关联客户'}</span>
                <span className="text-gray-300">·</span>
                <span>{typeLabel(detail.type)}</span>
                {detail.assigned_to_name && <><span className="text-gray-300">·</span><span>👤 {detail.assigned_to_name}</span></>}
                {detail.assigned_team && <><span className="text-gray-300">·</span><span>👥 {detail.assigned_team}</span></>}
                {detail.deadline_date && <><span className="text-gray-300">·</span><span className="text-red-500">截止: {detail.deadline_date}</span></>}
              </div>
              {detail.tags && (
                <div className="flex items-center gap-1.5 mt-2">
                  {detail.tags.split(',').map((t, i) => (
                    <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{t.trim()}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                window.harbor.invoke<Record<string,unknown> | null>('cases:export', detail.id).then(data => {
                  if (data) {
                    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href=url; a.download=`${detail.case_no}.json`; a.click()
                  }
                })
              }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors" title="导出为 JSON">
                📥 导出
              </button>
              <button onClick={() => {
                if (confirm('确定要归档此案件吗？')) {
                  window.harbor.invoke('cases:archive', detail.id, 'system').then(() => onBack())
                }
              }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors" title="归档案件">
                📦 归档
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn('px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px]',
                activeTab === t ? 'border-harbor-600 text-harbor-700' : 'border-transparent text-gray-400 hover:text-gray-600')}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === '概览' && <OverviewTab detail={detail} />}
          {activeTab === '文件' && <DocumentsTab caseId={caseId} />}
          {activeTab === '沟通' && <CommunicationsTab caseId={caseId} />}
          {activeTab === '任务' && <TasksTab caseId={caseId} />}
          {activeTab === '时间线' && <TimelineTab caseId={caseId} />}
          {activeTab === '风险' && <RiskTab caseId={caseId} />}
          {activeTab === '备注' && <NotesTab detail={detail} onUpdate={load} />}
        </div>
      </div>

      {/* AI Assistant Panel */}
      <AIAssistantPanel detail={detail} />
    </div>
  )
}

/* ── Tab: Overview ─────────────────────────────── */

function OverviewTab({ detail }: { detail: CaseDetail }) {
  return (
    <div className="space-y-5">
      {/* Customer Info */}
      <InfoCard title="客户信息" icon="👥">
        <InfoRow label="客户名称" value={detail.client_name} />
        <InfoRow label="监管方式" value={detail.supervision_mode} />
        <InfoRow label="成交方式" value={detail.transaction_method} />
        <InfoRow label="运输方式" value={detail.transport_mode} />
      </InfoCard>

      {/* Logistics */}
      <InfoCard title="物流信息" icon="🚢">
        <InfoRow label="启运港" value={detail.port_of_departure} />
        <InfoRow label="入境口岸" value={detail.port_of_entry} />
        <InfoRow label="船名" value={detail.vessel_name} />
        <InfoRow label="航次" value={detail.voyage_number} />
        <InfoRow label="提单号" value={detail.bill_of_lading} mono />
        <InfoRow label="集装箱号" value={detail.container_numbers?.join(', ')} mono />
        <InfoRow label="预计到港" value={detail.estimated_arrival} />
        <InfoRow label="启运国" value={detail.country_of_origin} />
        <InfoRow label="目的国" value={detail.country_of_destination} />
      </InfoCard>

      {/* Customs Info */}
      <InfoCard title="报关信息" icon="📋">
        <InfoRow label="申报币制" value={detail.declared_currency} />
        <InfoRow label="申报金额" value={detail.declared_value != null ? `USD ${detail.declared_value.toLocaleString()}` : null} />
        <InfoRow label="运费" value={detail.freight_amount != null ? `USD ${detail.freight_amount.toLocaleString()}` : null} />
        <InfoRow label="保费" value={detail.insurance_amount != null ? `USD ${detail.insurance_amount.toLocaleString()}` : null} />
        <InfoRow label="报关单号" value={detail.declaration_number} mono />
      </InfoCard>

      {/* Items */}
      {detail.items && detail.items.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-700">📦 商品明细 ({detail.items.length} 项)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-gray-50 text-left text-gray-400">
                <th className="px-5 py-2 font-medium">#</th><th className="px-5 py-2 font-medium">商品名称</th><th className="px-5 py-2 font-medium">品牌/型号</th><th className="px-5 py-2 font-medium">HS编码</th><th className="px-5 py-2 font-medium">数量</th><th className="px-5 py-2 font-medium">单价</th><th className="px-5 py-2 font-medium">总价</th>
              </tr></thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-gray-400">{item.sequence_no}</td>
                    <td className="px-5 py-2.5 font-medium text-gray-800">{item.product_name}{item.product_name_en && <span className="text-gray-400 ml-1 text-[11px]">{item.product_name_en}</span>}</td>
                    <td className="px-5 py-2.5 text-gray-500">{[item.brand, item.model].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-5 py-2.5 font-mono text-gray-600">{item.hs_code || '—'}{item.hs_code_confidence != null && <span className={cn('ml-1.5 text-[10px] rounded-full px-1.5 py-0.5', item.hs_code_confidence >= 0.9 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600')}>{Math.round(item.hs_code_confidence*100)}%</span>}</td>
                    <td className="px-5 py-2.5 text-gray-600">{item.quantity != null ? `${item.quantity} ${item.unit||''}` : '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{item.unit_price != null ? `${item.currency||''} ${item.unit_price}` : '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{item.total_price != null ? `${item.currency||''} ${item.total_price}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Documents ────────────────────────────── */

function DocumentsTab({ caseId }: { caseId: string }) {
  const [data, setData] = useState<{ documents: DocItem[]; checklist: ChecklistItem[] } | null>(null)
  useEffect(() => { window.harbor.invoke<{ documents: DocItem[]; checklist: ChecklistItem[] }>('cases:getDocuments', caseId).then(setData) }, [caseId])

  if (!data) return <p className="text-[13px] text-gray-400 py-8">加载中...</p>

  const required = data.checklist.filter(c => c.is_required)
  const received = required.filter(c => c.status === 'RECEIVED' || c.status === 'VERIFIED')
  const missing = required.filter(c => c.status !== 'RECEIVED' && c.status !== 'VERIFIED')

  return (
    <div className="space-y-5">
      <DocGroup title="已收到" icon="✅" color="text-green-600" items={received} docs={data.documents} />
      <DocGroup title="缺失" icon="⚠️" color="text-red-500" items={missing} docs={data.documents} />
      {data.documents.filter(d => !data.checklist.some(c => c.linked_document_id === d.id)).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-3">📄 其他文件</h3>
          {data.documents.filter(d => !data.checklist.some(c => (c as any).linked_document_id === d.id)).map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2 text-[13px]">
              <span>📎</span><span className="text-gray-700">{d.filename}</span>
              <span className="text-[11px] text-gray-400">{d.ocr_status === 'COMPLETED' ? 'OCR 已完成' : d.ocr_status}</span>
            </div>
          ))}
        </div>
      )}
      {data.checklist.length === 0 && data.documents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-[14px] text-gray-400">暂无文件记录</p>
        </div>
      )}
    </div>
  )
}

function DocGroup({ title, icon, color, items, docs }: { title: string; icon: string; color: string; items: ChecklistItem[]; docs: DocItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="text-[13px] font-semibold text-gray-700 mb-3">{icon} {title} ({items.length})</h3>
      <div className="space-y-1">
        {items.map(c => {
          const linked = docs.find(d => d.id === (c as any).linked_document_id)
          return (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
              <span className="text-[13px] text-gray-700">{c.doc_name_cn}</span>
              <span className={cn('text-[11px]', color)}>
                {linked ? linked.filename : c.status === 'RECEIVED' ? '已收到' : '缺失'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Tab: Communications ───────────────────────── */

function CommunicationsTab({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<CommItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.harbor.invoke<{ items: CommItem[] }>('communications:list', { linked_case_id: caseId, limit: '30' })
      .then(r => { setItems(r.items); setLoading(false) })
  }, [caseId])

  if (loading) return <p className="text-[13px] text-gray-400 py-8">加载中...</p>
  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-[14px] text-gray-400">暂无关联沟通记录</p>
      <p className="text-[13px] text-gray-300 mt-1">在收件箱中将沟通记录关联到此案件</p>
    </div>
  )

  const COMM_ICONS: Record<string, string> = { EMAIL:'📧', PHONE_CALL:'📞', MEETING:'🤝', WECHAT:'💬', MANUAL:'📝' }
  return (
    <div className="space-y-2">
      {items.map(c => (
        <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors">
          <div className="flex items-center gap-3">
            <span>{COMM_ICONS[c.comm_type] || '📎'}</span>
            <span className="text-[13px] text-gray-800 font-medium flex-1">{c.subject || c.from_name || '(无主题)'}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', priorityColor(c.priority))}>{priorityLabel(c.priority)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Tab: Tasks ────────────────────────────────── */

function TasksTab({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.harbor.invoke<{ items: TaskItem[] }>('tasks:list', 'system', { status: 'ALL', limit: '30' })
      .then(r => { setItems(r.items.filter((t: any) => t.case_id === caseId)); setLoading(false) })
  }, [caseId])

  if (loading) return <p className="text-[13px] text-gray-400 py-8">加载中...</p>
  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-[14px] text-gray-400">暂无关联系任务</p>
    </div>
  )

  const pending = items.filter(t => t.status === 'PENDING')
  const done = items.filter(t => t.status !== 'PENDING')

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-3">⏳ 待完成 ({pending.length})</h3>
          {pending.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
              <div className="h-4 w-4 rounded border-2 border-gray-200 shrink-0" />
              <span className="text-[13px] text-gray-700 flex-1">{t.title}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', priorityColor(t.priority))}>{priorityLabel(t.priority)}</span>
              <span className="text-[11px] text-gray-400">{t.due_date}</span>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 opacity-60">
          <h3 className="text-[13px] font-semibold text-gray-500 mb-3">✅ 已完成 ({done.length})</h3>
          {done.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2 px-3 line-through text-gray-400 text-[13px]">{t.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Tab: Timeline ─────────────────────────────── */

function TimelineTab({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  useEffect(() => {
    window.harbor.invoke<ActivityItem[]>('cases:getTimeline', caseId, 30).then(setItems)
  }, [caseId])

  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-[14px] text-gray-400">暂无活动记录</p>
    </div>
  )

  const typeIcon: Record<string,string> = { CASE_CREATED:'🆕', STATUS_CHANGED:'🔄', CASE_UPDATED:'✏️', CASE_DELETED:'🗑', COMM_CREATED:'📨', TASK_CREATED:'✅' }
  return (
    <div className="relative pl-6 border-l-2 border-gray-100 ml-3 space-y-4">
      {items.map(a => (
        <div key={a.id} className="relative">
          <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-white border-2 border-gray-200" />
          <p className="text-[13px] text-gray-700">{typeIcon[a.activity_type]||'📌'} {a.title || a.activity_type}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{a.user_name || '系统'} · {new Date(a.created_at).toLocaleString('zh-CN')}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Tab: Risk ─────────────────────────────────── */

function RiskTab({ caseId }: { caseId: string }) {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.harbor.invoke<{ risks: RiskItem[] }>('cases:getRiskAnalysis', caseId)
      .then(r => { setRisks(r.risks); setLoading(false) })
  }, [caseId])

  if (loading) return <p className="text-[13px] text-gray-400 py-8">分析中...</p>
  if (risks.length === 0) return (
    <div className="rounded-2xl border border-green-100 bg-green-50/30 p-8 text-center">
      <p className="text-[15px] text-green-700 font-medium">✅ 未检测到风险</p>
      <p className="text-[13px] text-green-500 mt-1">案件运行正常</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {risks.map((r, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 transition-colors">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-medium', severityBadge(r.severity))}>{severityLabel(r.severity)} 风险</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', confidenceBadge(r.confidence))}>置信度 {Math.round(r.confidence*100)}%</span>
            </div>
          </div>
          <h4 className="text-[14px] font-semibold text-gray-900">{r.title}</h4>
          <p className="text-[13px] text-gray-500 mt-1">{r.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[12px] text-gray-400">建议: {r.suggested_action}</span>
            <div className="flex-1" />
            <button className="rounded-lg px-3 py-1.5 text-[12px] text-green-600 hover:bg-green-50 transition-colors">✓ 采纳</button>
            <button className="rounded-lg px-3 py-1.5 text-[12px] text-gray-400 hover:bg-gray-50 transition-colors">✕ 忽略</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Tab: Notes ────────────────────────────────── */

function NotesTab({ detail, onUpdate }: { detail: CaseDetail; onUpdate: () => void }) {
  const [notes, setNotes] = useState(detail.internal_notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await window.harbor.invoke('cases:update', detail.id, { internalNotes: notes }, 'system')
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="内部备注..." rows={6}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-harbor-300 resize-none" />
      <button onClick={handleSave} disabled={saving}
        className="mt-3 rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-all">
        {saved ? '已保存 ✓' : saving ? '保存中...' : '保存备注'}
      </button>
    </div>
  )
}

/* ── AI Assistant Panel ────────────────────────── */

function AIAssistantPanel({ detail }: { detail: CaseDetail }) {
  const [collapsed, setCollapsed] = useState(false)
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const loadSummary = async () => {
    setSummaryLoading(true)
    const data = await window.harbor.invoke<Record<string, unknown> | null>('cases:getSummary', detail.id)
    setSummaryData(data)
    setSummaryLoading(false)
  }

  // Load summary on mount
  useEffect(() => { loadSummary() }, [detail.id])

  const s = summaryData

  return (
    <div className={cn('shrink-0 transition-all duration-200', collapsed ? 'w-10' : 'w-[280px]')}>
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-br from-harbor-50 to-white border border-harbor-100 p-3 mb-3 hover:border-harbor-200 transition-colors">
        {!collapsed && <span className="text-[12px] font-semibold text-harbor-700">🤖 AI 助手</span>}
        <span className="text-[11px] text-harbor-400">{collapsed ? '◀' : '▶'}</span>
      </button>
      {!collapsed && (
        <div className="space-y-3">
          {/* Case Summary */}
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">案件摘要</p>
            {summaryLoading ? (
              <div className="animate-pulse space-y-1.5">
                <div className="h-3 w-full rounded bg-gray-100"/><div className="h-3 w-3/4 rounded bg-gray-100"/>
              </div>
            ) : s ? (
              <div className="space-y-1.5 text-[13px] text-gray-600">
                <p><span className="text-gray-400">案件编号</span> {String(s.caseNo||'')} · {String(s.clientName||'')}</p>
                <p><span className="text-gray-400">类型</span> {String(s.type||'')} · {String(s.status||'')}</p>
                <p><span className="text-gray-400">商品</span> {String(s.itemCount||'0')} 项 · 文件 {String(s.docCount||'0')} 份</p>
                <p><span className="text-gray-400">任务</span> {String(s.taskPending||'0')} 待完成 / {String(s.taskDone||'0')} 已完成</p>
                <p><span className="text-gray-400">沟通</span> {String(s.commCount||'0')} 条记录</p>
                {(s.missingDocs as string[])?.length > 0 && (
                  <p className="text-red-500">缺失文件: {(s.missingDocs as string[]).join('、')}</p>
                )}
                {s.billOfLading ? <p className="text-gray-500 font-mono text-[12px]">B/L: {s.billOfLading as string}</p> : null}
                {s.estimatedArrival ? <p className="text-gray-500">ETA: {s.estimatedArrival as string}</p> : null}
              </div>
            ) : <p className="text-[13px] text-gray-400">暂无摘要数据</p>}
          </div>

          {/* Suggestions */}
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">下一步建议</p>
            <div className="space-y-2">
              {!detail.bill_of_lading && <SuggestionItem text="补充提单号" />}
              {!detail.declaration_number && <SuggestionItem text="补充报关单号" />}
              {!detail.estimated_arrival && <SuggestionItem text="确认预计到港日期" />}
              {!detail.assigned_team && <SuggestionItem text="分配给团队" />}
              {detail.status === 'DRAFT' && <SuggestionItem text="提交案件进入审核" />}
              <SuggestionItem text="检查商品 HS 编码" />
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">⚠️ AI 说明</p>
            <p className="text-[12px] text-amber-700 leading-relaxed">AI 仅提供建议，不会自动修改案件数据。所有操作需人工确认。</p>
          </div>
        </div>
      )}
    </div>
  )
}

function SuggestionItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-gray-600">
      <span className="text-harbor-500">•</span>
      <span className="flex-1">{text}</span>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────── */

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="text-[13px] font-semibold text-gray-700">{icon} {title}</h3>
      </div>
      <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-2.5">
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[12px] text-gray-400 shrink-0">{label}</span>
      <span className={cn('text-[13px] text-gray-700', mono && 'font-mono')}>{value || '—'}</span>
    </div>
  )
}

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-pulse space-y-5">
      <button onClick={onBack} className="text-[13px] text-gray-400">← 返回列表</button>
      <div className="rounded-2xl border border-gray-100 p-6"><div className="h-6 w-48 rounded bg-gray-100"/></div>
      <div className="flex gap-1"><div className="h-8 w-16 rounded bg-gray-100"/><div className="h-8 w-16 rounded bg-gray-100"/></div>
      <div className="rounded-2xl border border-gray-100 p-6 space-y-3">
        {Array.from({length:6}).map((_,i)=><div key={i} className="h-4 w-full rounded bg-gray-50"/>)}
      </div>
    </div>
  )
}
