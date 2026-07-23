import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */
interface CalEvent { id: string; title: string; description: string|null; event_type: string; start_time: string; end_time: string|null; all_day: number; priority: string; status: string; case_no: string|null; client_name: string|null; owner_name: string|null; location: string|null; color: string|null; tags: string[]|null; is_ai_suggested: number; ai_confidence: number|null; ai_reason: string|null }
interface Suggestion { title: string; event_type: string; start_time: string; case_id?: string; client_id?: string; reason: string; confidence: number }

/* ── Constants ─────────────────────────────────── */
const EVENT_TYPES: Record<string,{label:string;color:string;icon:string}> = {
  CASE_DEADLINE:{label:'案件截止',color:'border-l-red-500 bg-red-50',icon:'📋'},
  SHIPMENT_ETA:{label:'到港',color:'border-l-blue-500 bg-blue-50',icon:'🚢'},
  SHIPMENT_ETD:{label:'离港',color:'border-l-blue-500 bg-blue-50',icon:'🚢'},
  CUSTOMS_DECLARATION:{label:'报关',color:'border-l-purple-500 bg-purple-50',icon:'📝'},
  INSPECTION:{label:'查验',color:'border-l-orange-500 bg-orange-50',icon:'🔍'},
  DOCUMENT_DUE:{label:'文件截止',color:'border-l-amber-500 bg-amber-50',icon:'📄'},
  TASK_DEADLINE:{label:'任务截止',color:'border-l-green-500 bg-green-50',icon:'✅'},
  REMINDER:{label:'提醒',color:'border-l-gray-400 bg-gray-50',icon:'🔔'},
  MEETING:{label:'会议',color:'border-l-harbor-500 bg-harbor-50',icon:'🤝'},
  MANUAL:{label:'手动',color:'border-l-gray-400 bg-white',icon:'📌'},
}

/* ── Helpers ───────────────────────────────────── */
function getMonthDays(year:number,month:number){ const d=new Date(year,month,1); const days:Date[]=[]; while(d.getDay()!==0)d.setDate(d.getDate()-1); for(let i=0;i<42;i++){ days.push(new Date(d)); d.setDate(d.getDate()+1) } return days }
function sameDay(a:Date,b:Date){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function fmtDate(d:string){ return new Date(d).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}) }

/* ── Main ─────────────────────────────────────── */
export default function CalendarPage() {
  const now = new Date()
  const [view, setView] = useState<'month'|'week'|'agenda'|'timeline'>('month')
  const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState<CalEvent[]>([]); const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalEvent|null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showNew, setShowNew] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(year, month-1, 1).toISOString()
      const end = new Date(year, month+2, 0).toISOString()
      const r = await window.harbor.invoke<{items:CalEvent[]}>('calendar:list', {start,end})
      setEvents(r.items)
      const s = await window.harbor.invoke<{suggestions:Suggestion[]}>('calendar:getSuggestions')
      setSuggestions(s.suggestions)
    } catch(e){} finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { loadEvents() }, [loadEvents])

  const handleCreateFromSuggestion = async (s: Suggestion) => {
    await window.harbor.invoke('calendar:create', 'system', {
      title: s.title, event_type: s.event_type, start_time: s.start_time,
      case_id: s.case_id, client_id: s.client_id, is_ai_suggested: 1, ai_confidence: s.confidence, ai_reason: s.reason
    })
    loadEvents()
  }

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const weekDays = ['日','一','二','三','四','五','六']
  const days = getMonthDays(year, month)

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[220px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-gray-900">{year}年 {monthNames[month]}</h3>
        </div>
        {/* Mini calendar nav */}
        <div className="grid grid-cols-7 gap-0.5 mb-4">
          {weekDays.map(d => <div key={d} className="text-center text-[10px] text-gray-400 py-1">{d}</div>)}
          {days.map((d,i) => {
            const isCur = d.getMonth()===month; const isToday = sameDay(d,new Date())
            const hasEvent = events.some(e => sameDay(new Date(e.start_time), d))
            return <button key={i} onClick={()=>{setMonth(d.getMonth());setYear(d.getFullYear())}}
              className={cn('text-center text-[11px] py-1 rounded', isCur?'text-gray-700':'text-gray-300', isToday?'bg-harbor-600 text-white font-bold':'', hasEvent&&!isToday?'font-semibold':'')}>{d.getDate()}</button>
          })}
        </div>

        <FilterSection title="视图">
          {[{k:'month',l:'📅 月视图'},{k:'week',l:'📆 周视图'},{k:'agenda',l:'📋 日程'},{k:'timeline',l:'🔄 时间线'}].map(v => (
            <FilterItem key={v.k} label={v.l} active={view===v.k} onClick={()=>setView(v.k as any)} />
          ))}
        </FilterSection>

        <FilterSection title="AI 建议">
          <button onClick={()=>setShowSuggestions(true)} className="w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-harbor-600 hover:bg-harbor-50 transition-colors">
            🤖 {suggestions.length} 条建议
          </button>
        </FilterSection>

        <FilterSection title="类型">
          {Object.entries(EVENT_TYPES).map(([k,v]) => <FilterItem key={k} label={`${v.icon} ${v.label}`} active={false} onClick={()=>{}} />)}
        </FilterSection>
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-50 bg-white">
          <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50">◀</button>
          <span className="text-[14px] font-semibold text-gray-900 min-w-[100px] text-center">{year}年 {monthNames[month]}</span>
          <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50">▶</button>
          <button onClick={()=>{const n=new Date();setMonth(n.getMonth());setYear(n.getFullYear())}} className="rounded-lg px-3 py-1.5 text-[11px] text-gray-500 border border-gray-200 hover:bg-gray-50">今天</button>
          <div className="flex-1"/>
          <button onClick={()=>setShowNew(true)} className="rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-gray-800">+ 新建</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {view === 'month' && <MonthView days={days} month={month} events={events} onSelect={setSelected} selectedId={selected?.id} />}
          {view === 'agenda' && <AgendaView events={events} onSelect={setSelected} selectedId={selected?.id} />}
          {view === 'timeline' && <TimelineView events={events} onSelect={setSelected} selectedId={selected?.id} />}
          {view === 'week' && <AgendaView events={events.filter(e=>{const d=new Date(e.start_time);return d>=new Date(year,month,now.getDate()-now.getDay())&&d<=new Date(year,month,now.getDate()-now.getDay()+6)})} onSelect={setSelected} selectedId={selected?.id} />}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-[320px] shrink-0 overflow-y-auto bg-white">
        {selected ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', selected.priority==='URGENT'?'bg-red-50 text-red-600':selected.priority==='HIGH'?'bg-orange-50 text-orange-600':'bg-blue-50 text-blue-600')}>
                {selected.priority==='URGENT'?'紧急':selected.priority==='HIGH'?'高':'普通'}
              </span>
              <span className="text-[11px] text-gray-400">{EVENT_TYPES[selected.event_type]?.label||selected.event_type}</span>
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900">{selected.title}</h3>
            <p className="text-[13px] text-gray-500">{fmtDate(selected.start_time)}{selected.end_time?` - ${fmtDate(selected.end_time)}`:''}</p>
            {selected.description && <p className="text-[13px] text-gray-600">{selected.description}</p>}
            {selected.case_no && <p className="text-[13px] text-gray-500 font-mono">📋 {selected.case_no}</p>}
            {selected.client_name && <p className="text-[13px] text-gray-500">👥 {selected.client_name}</p>}
            {selected.owner_name && <p className="text-[13px] text-gray-500">👤 {selected.owner_name}</p>}
            {selected.location && <p className="text-[13px] text-gray-500">📍 {selected.location}</p>}
            {selected.is_ai_suggested ? <div className="rounded-xl bg-harbor-50 border border-harbor-100 p-3"><p className="text-[11px] text-harbor-600">🤖 AI 建议 · 置信度 {Math.round((selected.ai_confidence||0)*100)}%</p>{selected.ai_reason&&<p className="text-[12px] text-gray-500 mt-1">{selected.ai_reason}</p>}</div> : null}
            <button onClick={async()=>{await window.harbor.invoke('calendar:delete',selected.id);setSelected(null);loadEvents()}} className="w-full rounded-lg border border-red-200 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors">删除</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-[14px] text-gray-400">选择事件查看详情</p>
          </div>
        )}
      </div>

      {/* ── NEW EVENT MODAL ── */}
      {showNew && <NewEventModal onClose={()=>setShowNew(false)} onCreated={()=>{setShowNew(false);loadEvents()}} />}

      {/* ── SUGGESTIONS MODAL ── */}
      {showSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-[16px] font-bold text-gray-900">🤖 AI 日历建议</h3><button onClick={()=>setShowSuggestions(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">✕</button></div>
            <p className="text-[12px] text-gray-400 mb-4">AI 从案件、任务和物流信息中检测到以下时间节点。不会自动创建，请手动确认。</p>
            <div className="space-y-3">
              {suggestions.map((s,i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium text-gray-800">{s.title}</span><span className="rounded-full bg-harbor-50 px-2 py-0.5 text-[10px] text-harbor-600">{Math.round(s.confidence*100)}%</span></div>
                  <p className="text-[12px] text-gray-400 mb-2">{s.reason} · {fmtDate(s.start_time)}</p>
                  <button onClick={()=>handleCreateFromSuggestion(s)} className="rounded-lg bg-harbor-600 px-3 py-1.5 text-[11px] text-white hover:bg-harbor-700 transition-colors">添加到日历</button>
                </div>
              ))}
              {suggestions.length===0 && <p className="text-[13px] text-gray-400 text-center py-8">暂无可建议的日历事件</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── MonthView ─────────────────────────────────── */
function MonthView({days,month,events,onSelect,selectedId}:{days:Date[];month:number;events:CalEvent[];onSelect:(e:CalEvent)=>void;selectedId?:string}){
  const weekDays = ['日','一','二','三','四','五','六']
  return <div className="h-full flex flex-col">
    <div className="grid grid-cols-7 border-b border-gray-100">{weekDays.map(d=><div key={d} className="text-center text-[11px] text-gray-400 py-2 font-medium">{d}</div>)}</div>
    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
      {days.map((d,i)=>{
        const dayEvents = events.filter(e=>sameDay(new Date(e.start_time),d))
        const isCur = d.getMonth()===month; const isToday = sameDay(d,new Date())
        return <div key={i} className={cn('border-r border-b border-gray-50 p-1 overflow-hidden',!isCur&&'bg-gray-50/30',isToday&&'bg-harbor-50/30')}>
          <span className={cn('text-[11px] px-1',isCur?'text-gray-700':'text-gray-300',isToday?'font-bold text-harbor-600':'')}>{d.getDate()}</span>
          {dayEvents.slice(0,3).map(e=><button key={e.id} onClick={()=>onSelect(e)} className={cn('w-full text-left rounded px-1.5 py-0.5 text-[10px] truncate mb-0.5',EVENT_TYPES[e.event_type]?.color,selectedId===e.id?'ring-1 ring-harbor-400':'','hover:opacity-80 transition-opacity')}>{e.title}</button>)}
          {dayEvents.length>3&&<span className="text-[10px] text-gray-400 px-1">+{dayEvents.length-3} 更多</span>}
        </div>
      })}
    </div>
  </div>
}

/* ── AgendaView ────────────────────────────────── */
function AgendaView({events,onSelect,selectedId}:{events:CalEvent[];onSelect:(e:CalEvent)=>void;selectedId?:string}){
  const sorted = [...events].sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime())
  let lastDate = ''
  return <div className="p-4 space-y-1">
    {sorted.map(e=>{
      const dateStr = new Date(e.start_time).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'})
      const showDate = dateStr!==lastDate; lastDate=dateStr
      return <div key={e.id}>
        {showDate&&<p className="text-[11px] font-semibold text-gray-400 pt-3 pb-1">{dateStr}</p>}
        <button onClick={()=>onSelect(e)} className={cn('w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors',EVENT_TYPES[e.event_type]?.color,selectedId===e.id?'ring-1 ring-harbor-400':'')}>
          <span>{EVENT_TYPES[e.event_type]?.icon||'📌'}</span>
          <div className="min-w-0 flex-1"><p className="text-[13px] text-gray-800 truncate">{e.title}</p><p className="text-[11px] text-gray-400">{fmtDate(e.start_time)}{e.end_time?` - ${fmtDate(e.end_time)}`:''}</p></div>
          {e.case_no&&<span className="text-[10px] text-gray-400 font-mono shrink-0">{e.case_no}</span>}
        </button>
      </div>
    })}
    {events.length===0&&<p className="text-[13px] text-gray-400 text-center py-16">暂无日程</p>}
  </div>
}

/* ── TimelineView ──────────────────────────────── */
function TimelineView({events,onSelect,selectedId}:{events:CalEvent[];onSelect:(e:CalEvent)=>void;selectedId?:string}){
  const sorted = [...events].sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime())
  const milestones = sorted.filter(e=>['CASE_DEADLINE','SHIPMENT_ETA','SHIPMENT_ETD','CUSTOMS_DECLARATION','INSPECTION','TASK_DEADLINE'].includes(e.event_type))
  return <div className="p-8">
    <h3 className="text-[15px] font-bold text-gray-900 mb-6">🔄 业务时间线</h3>
    <div className="relative pl-8 border-l-2 border-gray-100 ml-4 space-y-6">
      {milestones.map((e,i)=><div key={e.id} className="relative">
        <div className="absolute -left-[34px] top-1 h-4 w-4 rounded-full bg-white border-2 border-harbor-500"/>
        <button onClick={()=>onSelect(e)} className={cn('text-left rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors w-full',selectedId===e.id?'ring-1 ring-harbor-400':'')}>
          <div className="flex items-center gap-2 mb-1"><span>{EVENT_TYPES[e.event_type]?.icon||'📌'}</span><span className="text-[11px] font-medium text-gray-400">{EVENT_TYPES[e.event_type]?.label}</span><span className="text-[11px] text-gray-300">{fmtDate(e.start_time)}</span></div>
          <p className="text-[14px] font-medium text-gray-800">{e.title}</p>
          {e.case_no&&<p className="text-[12px] text-gray-400 font-mono mt-0.5">{e.case_no}</p>}
          {e.client_name&&<p className="text-[12px] text-gray-400">{e.client_name}</p>}
        </button>
      </div>)}
      {milestones.length===0&&<p className="text-[13px] text-gray-400 py-8">暂无业务里程碑。AI 建议会根据案件和任务自动生成时间线节点。</p>}
    </div>
  </div>
}

/* ── NewEventModal ─────────────────────────────── */
function NewEventModal({onClose,onCreated}:{onClose:()=>void;onCreated:()=>void}){
  const [title,setTitle]=useState(''); const [date,setDate]=useState(new Date().toISOString().split('T')[0]); const [type,setType]=useState('MANUAL'); const [priority,setPriority]=useState('NORMAL'); const [saving,setSaving]=useState(false)
  const save=async()=>{if(!title.trim())return;setSaving(true);await window.harbor.invoke('calendar:create','system',{title:title.trim(),event_type:type,start_time:date,priority});setSaving(false);onCreated()}
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4"><h3 className="text-[16px] font-bold text-gray-900 mb-4">新建事件</h3><div className="space-y-3">
    <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="事件标题" autoFocus className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/>
    <div className="flex gap-3"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500"/>
    <select value={priority} onChange={e=>setPriority(e.target.value)} className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white"><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select></div>
    <select value={type} onChange={e=>setType(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white">{Object.entries(EVENT_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</select>
    <div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] text-gray-500">取消</button><button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-[13px] font-medium text-white">保存</button></div>
  </div></div></div>
}

/* ── Shared ────────────────────────────────────── */
function FilterSection({title,children}:{title:string;children:React.ReactNode}){ const [open,setOpen]=useState(true); return <div className="mb-4"><button onClick={()=>setOpen(!open)} className="flex items-center justify-between w-full mb-1.5"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span><span className="text-[10px] text-gray-300">{open?'▾':'▸'}</span></button>{open&&<div className="space-y-0.5">{children}</div>}</div> }
function FilterItem({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){ return <button onClick={onClick} className={cn('w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',active?'bg-gray-100 text-gray-900 font-medium':'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}>{label}</button> }
