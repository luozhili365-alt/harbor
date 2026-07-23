import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */

interface DocItem { id: string; filename: string; doc_type: string; status: string; file_size: number; case_no: string | null; client_name: string | null; is_verified: number; ocr_status: string | null; extracted_data: any; created_at: string }
interface DocStats { pendingReview: number; missing: number; total: number }
interface MissingDoc { id: string; doc_type: string; doc_name_cn: string; case_no: string | null; client_name: string | null; tier: number; status: string }

/* ── Constants ─────────────────────────────────── */

const DOC_TYPES: Record<string,string> = { INVOICE:'商业发票', PACKING_LIST:'装箱单', BILL_OF_LADING:'提单', CERTIFICATE:'原产地证', CUSTOMS_DECLARATION:'报关单', ARRIVAL_NOTICE:'到货通知', DELIVERY_ORDER:'提货单', PURCHASE_ORDER:'采购订单', CONTRACT:'合同', INSURANCE:'保险单', OTHER:'其他' }
const TYPE_ICONS: Record<string,string> = { INVOICE:'🧾', PACKING_LIST:'📦', BILL_OF_LADING:'🚢', CERTIFICATE:'📜', CUSTOMS_DECLARATION:'📋', ARRIVAL_NOTICE:'📬', CONTRACT:'📝', INSURANCE:'🛡️', OTHER:'📄' }
const STATUS_OPTS = ['UPLOADED','PROCESSING','REVIEW_REQUIRED','APPROVED','REJECTED']

function statusLabel(s:string){ const m:Record<string,string>={UPLOADED:'已上传',PROCESSING:'处理中',REVIEW_REQUIRED:'待审核',APPROVED:'已通过',REJECTED:'已驳回',ARCHIVED:'已归档'}; return m[s]||s }
function statusColor(s:string){ const m:Record<string,string>={UPLOADED:'bg-blue-50 text-blue-600',PROCESSING:'bg-purple-50 text-purple-600',REVIEW_REQUIRED:'bg-amber-50 text-amber-600',APPROVED:'bg-green-50 text-green-600',REJECTED:'bg-red-50 text-red-600'}; return m[s]||'' }

/* ── Main ─────────────────────────────────────── */

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([]); const [stats, setStats] = useState<DocStats>({pendingReview:0,missing:0,total:0})
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<DocItem|null>(null)
  const [filterType, setFilterType] = useState(''); const [filterStatus, setFilterStatus] = useState(''); const [searchQ, setSearchQ] = useState('')
  const [missingDocs, setMissingDocs] = useState<MissingDoc[]>([])
  const [showUploading, setShowUploading] = useState(false)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try { const f: Record<string,string>={limit:'50'}; if(filterType)f.doc_type=filterType; if(filterStatus)f.status=filterStatus; if(searchQ)f.q=searchQ
      const r = await window.harbor.invoke<{items:DocItem[];total:number;stats:DocStats}>('documents:list',f)
      setDocs(r.items); setStats(r.stats)
      // Also load missing docs
      const m = await window.harbor.invoke<{items:MissingDoc[];total:number}>('documents:getMissing')
      setMissingDocs(m.items)
    } catch(e){} finally { setLoading(false) }
  }, [filterType, filterStatus, searchQ])

  useEffect(() => { loadDocs() }, [loadDocs])

  const handleUpload = async () => {
    setShowUploading(true)
    try { await window.harbor.invoke('documents:upload', 'system', {}); loadDocs() }
    catch(e){} finally { setShowUploading(false) }
  }

  const handleVerify = async (id: string, approved: boolean) => {
    await window.harbor.invoke('documents:verify', id, 'system', approved)
    setSelected(null); loadDocs()
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[220px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 mb-5">
          <StatBadge label="全部" value={stats.total} color="bg-gray-50 text-gray-700" />
          <StatBadge label="待审核" value={stats.pendingReview} color="bg-amber-50 text-amber-600" />
          <StatBadge label="缺失" value={stats.missing} color="bg-red-50 text-red-600" />
        </div>

        <FilterSection title="状态">
          {STATUS_OPTS.map(s => <FilterItem key={s} label={statusLabel(s)} active={filterStatus===s} onClick={()=>setFilterStatus(filterStatus===s?'':s)} />)}
        </FilterSection>
        <FilterSection title="类型">
          {Object.entries(DOC_TYPES).map(([k,v]) => <FilterItem key={k} label={`${TYPE_ICONS[k]||'📄'} ${v}`} active={filterType===k} onClick={()=>setFilterType(filterType===k?'':k)} />)}
        </FilterSection>

        {/* Missing Docs */}
        {missingDocs.length > 0 && (
          <FilterSection title={`缺失文件 (${missingDocs.length})`}>
            {missingDocs.slice(0,10).map(d => (
              <div key={d.id} className="text-[11px] text-red-500 py-1 px-2">
                ⚠ {d.doc_name_cn} {d.case_no && <span className="text-gray-400 ml-1">{d.case_no}</span>}
              </div>
            ))}
          </FilterSection>
        )}
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-50 bg-white">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-300">🔍</span>
            <input type="text" placeholder="搜索文件名..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[13px] outline-none focus:border-harbor-300 focus:bg-white transition-colors" />
          </div>
          <span className="text-[12px] text-gray-400">{stats.total} 个文件</span>
          <button onClick={handleUpload} disabled={showUploading}
            className="shrink-0 rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-gray-800 transition-colors">
            {showUploading ? '上传中...' : '+ 上传文件'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:6}).map((_,i)=><div key={i} className="animate-pulse rounded-xl border border-gray-50 p-4"><div className="h-3 w-48 rounded bg-gray-100"/></div>)}</div>
          : docs.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-5xl mb-4">📂</div>
              <h3 className="text-[15px] font-semibold text-gray-700 mb-1">暂无文件</h3>
              <p className="text-[13px] text-gray-400 mb-4">上传文件以开始管理报关单证</p>
              <button onClick={handleUpload} className="rounded-lg bg-harbor-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-harbor-700 transition-colors">上传第一个文件</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {docs.map(d => (
                <button key={d.id} onClick={()=>setSelected(d)}
                  className={cn('w-full text-left px-5 py-3.5 transition-all duration-150 hover:bg-gray-50/50', selected?.id===d.id?'bg-harbor-50/50 border-l-2 border-l-harbor-500':'border-l-2 border-l-transparent')}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{TYPE_ICONS[d.doc_type]||'📄'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-gray-800 truncate font-medium">{d.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400">{DOC_TYPES[d.doc_type]||d.doc_type}</span>
                        {d.client_name && <><span className="text-gray-300">·</span><span className="text-[11px] text-gray-400">{d.client_name}</span></>}
                        {d.case_no && <><span className="text-gray-300">·</span><span className="text-[11px] text-gray-400 font-mono">{d.case_no}</span></>}
                      </div>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', statusColor(d.status))}>{statusLabel(d.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-[340px] shrink-0 overflow-y-auto bg-white">
        {selected ? (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', statusColor(selected.status))}>{statusLabel(selected.status)}</span>
              <span className="text-[11px] text-gray-400">{DOC_TYPES[selected.doc_type]||selected.doc_type}</span>
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 break-all">{selected.filename}</h3>
            {selected.client_name && <p className="text-[13px] text-gray-500">客户: {selected.client_name}</p>}
            {selected.case_no && <p className="text-[13px] text-gray-500 font-mono">案件: {selected.case_no}</p>}

            {/* AI Classification */}
            {selected.extracted_data?.classification && (
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">AI 分类</p>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-gray-800">{DOC_TYPES[selected.extracted_data.classification.type]||selected.extracted_data.classification.type}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', selected.extracted_data.classification.confidence>=0.8?'bg-green-50 text-green-600':selected.extracted_data.classification.confidence>=0.6?'bg-amber-50 text-amber-600':'bg-red-50 text-red-500')}>
                    {Math.round(selected.extracted_data.classification.confidence*100)}%
                  </span>
                </div>
              </div>
            )}

            {/* AI Classify button */}
            <button onClick={async ()=>{
              const r = await window.harbor.invoke<{type:string;confidence:number;reason:string}|null>('documents:classify',selected.id)
              if(r){ loadDocs(); setSelected({...selected, doc_type:r.type, extracted_data:{...selected.extracted_data, classification:{type:r.type,confidence:r.confidence,reason:r.reason}}}) }
            }} className="w-full rounded-xl bg-gradient-to-r from-harbor-500 to-harbor-600 px-4 py-3 text-[13px] font-medium text-white hover:from-harbor-600 hover:to-harbor-700 transition-all shadow-sm shadow-harbor-200">
              🤖 AI 分类
            </button>

            {/* Verification */}
            <div className="flex gap-2">
              <button onClick={()=>handleVerify(selected.id,true)} className="flex-1 rounded-xl bg-green-600 py-2.5 text-[13px] font-medium text-white hover:bg-green-700 transition-colors">✓ 通过</button>
              <button onClick={()=>handleVerify(selected.id,false)} className="flex-1 rounded-xl border border-red-200 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">✕ 驳回</button>
            </div>

            <button onClick={async()=>{await window.harbor.invoke('documents:delete',selected.id);setSelected(null);loadDocs()}}
              className="w-full rounded-lg border border-gray-200 py-2 text-[12px] text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">删除</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[14px] text-gray-400">选择文件查看详情</p>
            <p className="text-[12px] text-gray-300 mt-1">AI 分析和审核工作区</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ────────────────────────────── */

function StatBadge({label,value,color}:{label:string;value:number;color:string}){ return <div className={cn('rounded-xl px-2.5 py-2 text-center',color)}><p className="text-[18px] font-bold tabular-nums">{value}</p><p className="text-[10px] opacity-70">{label}</p></div> }
function FilterSection({title,children}:{title:string;children:React.ReactNode}){ const [open,setOpen]=useState(true); return <div className="mb-4"><button onClick={()=>setOpen(!open)} className="flex items-center justify-between w-full mb-1.5"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span><span className="text-[10px] text-gray-300">{open?'▾':'▸'}</span></button>{open&&<div className="space-y-0.5">{children}</div>}</div> }
function FilterItem({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){ return <button onClick={onClick} className={cn('w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',active?'bg-gray-100 text-gray-900 font-medium':'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}>{label}</button> }
