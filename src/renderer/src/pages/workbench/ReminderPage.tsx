import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */
interface Reminder { id: string; title: string; description: string|null; reminder_type: string; priority: string; status: string; due_date: string; due_time: string|null; owner_name: string|null; case_no: string|null; client_name: string|null; is_ai_suggested: number; ai_confidence: number|null; ai_reason: string|null; snooze_until: string|null; notes: string|null; tags: string[]|null }
interface RemStats { critical: number; high: number; overdue: number; aiSuggestions: number }
interface Suggestion { title:string; reminder_type:string; priority:string; due_date:string; case_id?:string; client_id?:string; reason:string; confidence:number }

/* ── Constants ─────────────────────────────────── */
const TYPE_LABELS: Record<string,string> = { CASE_DEADLINE:'案件截止', DOCUMENT_DEADLINE:'文件截止', INSPECTION:'查验', SHIPMENT_ETA:'到港', SHIPMENT_ETD:'离港', CUSTOMER_FOLLOWUP:'客户跟进', PAYMENT:'付款', COMPLIANCE:'合规', TASK_DEADLINE:'任务截止', MANUAL:'手动' }
const PRIORITY_COLORS: Record<string,string> = { CRITICAL:'bg-red-50 text-red-600 border-red-100', HIGH:'bg-orange-50 text-orange-600 border-orange-100', MEDIUM:'bg-blue-50 text-blue-600 border-blue-100', LOW:'bg-gray-100 text-gray-500' }
const STATUS_COLORS: Record<string,string> = { PENDING:'bg-blue-50 text-blue-600', IN_PROGRESS:'bg-amber-50 text-amber-600', COMPLETED:'bg-green-50 text-green-600', CANCELLED:'bg-gray-100 text-gray-400', SNOOZED:'bg-purple-50 text-purple-600' }
function pLabel(p:string){ const m:Record<string,string>={CRITICAL:'严重',HIGH:'高',MEDIUM:'中',LOW:'低'}; return m[p]||p }
function sLabel(s:string){ const m:Record<string,string>={PENDING:'待处理',IN_PROGRESS:'进行中',COMPLETED:'已完成',CANCELLED:'已取消',SNOOZED:'已推迟'}; return m[s]||s }

/* ── Main ─────────────────────────────────────── */
export default function ReminderPage() {
  const [items, setItems] = useState<Reminder[]>([]); const [stats, setStats] = useState<RemStats>({critical:0,high:0,overdue:0,aiSuggestions:0})
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<Reminder|null>(null)
  const [filterStatus, setFilterStatus] = useState('ACTIVE'); const [filterPriority, setFilterPriority] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showNew, setShowNew] = useState(false)
  const [nlInput, setNlInput] = useState('')
  const [nlCreating, setNlCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const f: Record<string,string>={limit:'50'}; if(filterStatus)f.status=filterStatus; if(filterPriority)f.priority=filterPriority
      const r = await window.harbor.invoke<{items:Reminder[];stats:RemStats}>('reminders:list',f)
      setItems(r.items); setStats(r.stats)
      const s = await window.harbor.invoke<{suggestions:Suggestion[]}>('reminders:getSuggestions')
      setSuggestions(s.suggestions)
    } catch(e){} finally { setLoading(false) }
  }, [filterStatus, filterPriority])

  useEffect(() => { load() }, [load])

  const handleComplete = async (id: string) => { await window.harbor.invoke('reminders:complete', id, 'system'); setSelected(null); load() }
  const handleSnooze = async (id: string, until: string) => { await window.harbor.invoke('reminders:snooze', id, until); load() }
  const handleCancel = async (id: string) => { await window.harbor.invoke('reminders:cancel', id); setSelected(null); load() }
  const handleAcceptSuggestion = async (s: Suggestion) => { await window.harbor.invoke('reminders:create', 'system', {title:s.title,reminder_type:s.reminder_type,priority:s.priority,due_date:s.due_date,case_id:s.case_id,client_id:s.client_id,is_ai_suggested:1,ai_confidence:s.confidence,ai_reason:s.reason}); load() }

  // Natural language reminder creation
  const handleNLCreate = async () => {
    if (!nlInput.trim()) return
    setNlCreating(true)
    // Parse: "提醒我明天检查HS编码" → title, extract time clues
    const text = nlInput.trim()
    let dueDate = new Date().toISOString().split('T')[0]
    if (/明天/.test(text)) { const d=new Date(); d.setDate(d.getDate()+1); dueDate = d.toISOString().split('T')[0] }
    else if (/后天/.test(text)) { const d=new Date(); d.setDate(d.getDate()+2); dueDate = d.toISOString().split('T')[0] }
    else if (/下周/.test(text)) { const d=new Date(); d.setDate(d.getDate()+7); dueDate = d.toISOString().split('T')[0] }

    let priority = 'MEDIUM'
    if (/紧急|马上|立刻|立即/.test(text)) priority = 'CRITICAL'
    else if (/重要|尽快|尽快/.test(text)) priority = 'HIGH'

    // Clean title
    let title = text.replace(/提醒我|明天|后天|下周|下周一|紧急|重要/g,'').replace(/^\s*[，,]\s*/,'').trim()
    if (!title) title = text

    await window.harbor.invoke('reminders:create', 'system', { title, priority, due_date: dueDate, reminder_type: 'MANUAL' })
    setNlInput(''); setNlCreating(false); load()
  }

  // Upcoming items
  const upcoming = items.filter(i => i.status !== 'COMPLETED' && i.status !== 'CANCELLED').slice(0, 8)
  const overdue = items.filter(i => i.status !== 'COMPLETED' && i.status !== 'CANCELLED' && new Date(i.due_date) < new Date())

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── LEFT ── */}
      <div className="w-[190px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4">
        <div className="rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 p-3 mb-4">
          <p className="text-[10px] text-gray-400 mb-2">⏰ 指挥中心</p>
          <div className="grid grid-cols-2 gap-1.5">
            {stats.critical>0 && <span className="text-[16px] font-bold text-red-400">{stats.critical}<span className="text-[8px] ml-0.5">严重</span></span>}
            {stats.high>0 && <span className="text-[16px] font-bold text-orange-400">{stats.high}<span className="text-[8px] ml-0.5">高</span></span>}
            {stats.overdue>0 && <span className="text-[16px] font-bold text-gray-400">{stats.overdue}<span className="text-[8px] ml-0.5">逾期</span></span>}
            {stats.aiSuggestions>0 && <span className="text-[16px] font-bold text-purple-400">{stats.aiSuggestions}<span className="text-[8px] ml-0.5">AI</span></span>}
          </div>
        </div>

        <FilterSection title="状态">
          {[{k:'ACTIVE',l:'活跃'},{k:'PENDING',l:'待处理'},{k:'SNOOZED',l:'已推迟'},{k:'COMPLETED',l:'已完成'},{k:'CANCELLED',l:'已取消'}].map(o=>(
            <FilterItem key={o.k} label={o.l} active={filterStatus===o.k} onClick={()=>setFilterStatus(filterStatus===o.k?'':o.k)} />
          ))}
        </FilterSection>
        <FilterSection title="优先级">
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(p=>(
            <FilterItem key={p} label={pLabel(p)} active={filterPriority===p} onClick={()=>setFilterPriority(filterPriority===p?'':p)} />
          ))}
        </FilterSection>
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-50 bg-white">
          <span className="text-[14px] font-bold text-gray-900">提醒引擎</span>
          <span className="text-[12px] text-gray-400">{items.length} 项</span>
          <div className="flex-1"/>
          <button onClick={()=>setShowNew(true)} className="rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-gray-800">+ 新建</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── COMMAND CENTRE ── */}
          {!loading && (
            <div className="m-4 space-y-4">
              {/* Natural language input */}
              <div className="flex gap-2">
                <input type="text" value={nlInput} onChange={e=>setNlInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleNLCreate()}}
                  placeholder='自然语言创建提醒，例如: "提醒我明天检查 HS 编码"'
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] outline-none focus:border-harbor-300"/>
                <button onClick={handleNLCreate} disabled={nlCreating}
                  className="rounded-xl bg-harbor-600 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-harbor-700 disabled:opacity-50">创建</button>
              </div>

              {/* Overdue warning */}
              {overdue.length > 0 && (
                <div className="rounded-2xl bg-red-50/50 border border-red-100 p-4">
                  <p className="text-[12px] font-semibold text-red-600 mb-2">⚠️ 已逾期 ({overdue.length})</p>
                  <div className="space-y-1">
                    {overdue.slice(0,3).map(o => (
                      <p key={o.id} className="text-[12px] text-red-500">• {o.title} — {o.due_date}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="rounded-2xl bg-harbor-50/50 border border-harbor-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-harbor-700">🤖 AI 建议 ({suggestions.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {suggestions.slice(0,4).map((s,i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <span className="text-[12px] text-gray-700 flex-1 truncate">{s.title}</span>
                        <span className="text-[10px] text-gray-400">{Math.round(s.confidence*100)}%</span>
                        <button onClick={()=>handleAcceptSuggestion(s)} className="shrink-0 rounded-md bg-harbor-600 px-2 py-0.5 text-[10px] text-white hover:bg-harbor-700">✓</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REMINDER LIST ── */}
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="animate-pulse rounded-xl border border-gray-50 p-4"><div className="h-3 w-48 rounded bg-gray-100"/></div>)}</div>
          : items.length===0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-4xl mb-3">⏰</div>
              <p className="text-[14px] text-gray-400">暂无提醒</p>
              <p className="text-[13px] text-gray-300 mt-1">用上面的自然语言输入框快速创建提醒</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(r => (
                <button key={r.id} onClick={()=>setSelected(r)} className={cn('w-full text-left px-5 py-3.5 transition-all duration-150 hover:bg-gray-50/50', selected?.id===r.id?'bg-harbor-50/50 border-l-2 border-l-harbor-500':'border-l-2 border-l-transparent')}>
                  <div className="flex items-center gap-3">
                    <button onClick={e=>{e.stopPropagation();handleComplete(r.id)}} className="h-4 w-4 shrink-0 rounded border-2 border-gray-200 hover:border-green-400 transition-colors" title="完成"/>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[14px] truncate', r.status==='COMPLETED'?'line-through text-gray-400':'text-gray-800')}>{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[r.priority])}>{pLabel(r.priority)}</span>
                        <span className="text-[11px] text-gray-400">{r.due_date}{r.due_time?` ${r.due_time}`:''}</span>
                        {r.case_no&&<><span className="text-gray-300">·</span><span className="text-[11px] text-gray-400 font-mono">{r.case_no}</span></>}
                        {r.client_name&&<><span className="text-gray-300">·</span><span className="text-[11px] text-gray-400">{r.client_name}</span></>}
                        {r.is_ai_suggested?<span className="text-[10px] text-harbor-500">🤖</span>:null}
                      </div>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', STATUS_COLORS[r.status])}>{sLabel(r.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="w-[320px] shrink-0 overflow-y-auto bg-white">
        {selected ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', PRIORITY_COLORS[selected.priority])}>{pLabel(selected.priority)}</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', STATUS_COLORS[selected.status])}>{sLabel(selected.status)}</span>
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900">{selected.title}</h3>
            {selected.description && <p className="text-[13px] text-gray-600">{selected.description}</p>}
            <p className="text-[13px] text-gray-500">📅 {selected.due_date}{selected.due_time?` ${selected.due_time}`:''}</p>
            {selected.case_no && <p className="text-[13px] text-gray-500 font-mono">📋 {selected.case_no}</p>}
            {selected.client_name && <p className="text-[13px] text-gray-500">👥 {selected.client_name}</p>}
            {selected.notes && <div className="rounded-xl bg-gray-50 p-3"><p className="text-[12px] text-gray-500">{selected.notes}</p></div>}
            {selected.is_ai_suggested ? <div className="rounded-xl bg-harbor-50 border border-harbor-100 p-3"><p className="text-[11px] text-harbor-600">🤖 AI · {Math.round((selected.ai_confidence||0)*100)}%</p><p className="text-[12px] text-gray-500 mt-1">{selected.ai_reason}</p></div> : null}
            <div className="space-y-2">
              <button onClick={()=>handleComplete(selected.id)} className="w-full rounded-xl bg-green-600 py-2.5 text-[13px] font-medium text-white hover:bg-green-700 transition-colors">✓ 完成</button>
              <div className="flex gap-2">
                <button onClick={()=>handleSnooze(selected.id, new Date(Date.now()+86400000).toISOString())} className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] text-gray-500 hover:bg-gray-50">推迟到明天</button>
                <button onClick={()=>handleSnooze(selected.id, new Date(Date.now()+3600000).toISOString())} className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] text-gray-500 hover:bg-gray-50">1小时</button>
              </div>
              <button onClick={()=>handleCancel(selected.id)} className="w-full rounded-lg border border-red-200 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors">取消</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8"><div className="text-4xl mb-3">🔔</div><p className="text-[14px] text-gray-400">选择提醒查看详情</p></div>
        )}
      </div>

      {showNew && <NewReminderModal onClose={()=>setShowNew(false)} onCreated={()=>{setShowNew(false);load()}} />}
    </div>
  )
}

/* ── NewReminderModal ──────────────────────────── */
function NewReminderModal({onClose,onCreated}:{onClose:()=>void;onCreated:()=>void}){
  const [title,setTitle]=useState(''); const [date,setDate]=useState(new Date().toISOString().split('T')[0]); const [priority,setPriority]=useState('MEDIUM'); const [type,setType]=useState('MANUAL'); const [saving,setSaving]=useState(false)
  const save=async()=>{if(!title.trim())return;setSaving(true);await window.harbor.invoke('reminders:create','system',{title:title.trim(),reminder_type:type,priority,due_date:date});setSaving(false);onCreated()}
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4"><h3 className="text-[16px] font-bold text-gray-900 mb-4">新建提醒</h3><div className="space-y-3">
    <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="提醒标题" autoFocus className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/>
    <div className="flex gap-3"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500"/>
    <select value={priority} onChange={e=>setPriority(e.target.value)} className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option><option value="CRITICAL">严重</option></select></div>
    <select value={type} onChange={e=>setType(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white">{Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] text-gray-500">取消</button><button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-[13px] font-medium text-white">保存</button></div>
  </div></div></div>
}

/* ── Shared ────────────────────────────────────── */
function FilterSection({title,children}:{title:string;children:React.ReactNode}){ const [open,setOpen]=useState(true); return <div className="mb-4"><button onClick={()=>setOpen(!open)} className="flex items-center justify-between w-full mb-1.5"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span><span className="text-[10px] text-gray-300">{open?'▾':'▸'}</span></button>{open&&<div className="space-y-0.5">{children}</div>}</div> }
function FilterItem({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){ return <button onClick={onClick} className={cn('w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',active?'bg-gray-100 text-gray-900 font-medium':'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}>{label}</button> }
