import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */

interface ClientItem { id: string; company_name: string; company_name_en: string | null; country: string | null; industry: string | null; status: string; risk_level: string; customs_code: string | null; customs_grade: string | null; contact_person: string | null; account_manager_name: string | null; updated_at: string }
interface ClientDetail { id: string; company_name: string; company_name_en: string | null; legal_name: string | null; country: string | null; website: string | null; industry: string | null; tax_number: string | null; registration_number: string | null; preferred_language: string | null; status: string; risk_level: string; account_manager_name: string | null; contact_person: string | null; contact_phone: string | null; contact_email: string | null; customs_code: string | null; customs_grade: string | null; address: string | null; notes: string | null; internal_notes: string | null; tags: string[] | null; health_score: number | null; health_factors: string[] | null; activeCaseCount: number; contacts: Contact[]; cases: any[]; communications: any[]; documents: any[]; created_at: string; updated_at: string }
interface Contact { id: string; name: string; position: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; preferred_comm: string | null; is_primary: number; notes: string | null }

/* ── Constants ─────────────────────────────────── */

const STATUS_OPTS = ['ACTIVE','PROSPECT','INACTIVE','ARCHIVED']
const RISK_OPTS = ['LOW','MEDIUM','HIGH','CRITICAL']
const TABS = ['概览','联系人','案件','沟通','文件','健康'] as const
type Tab = typeof TABS[number]

function statusLabel(s: string) { const m: Record<string,string>={ACTIVE:'活跃',PROSPECT:'潜在',INACTIVE:'不活跃',ARCHIVED:'已归档'}; return m[s]||s }
function riskLabel(s: string) { const m: Record<string,string>={LOW:'低',MEDIUM:'中',HIGH:'高',CRITICAL:'严重'}; return m[s]||s }
function riskColor(s: string) { const m: Record<string,string>={LOW:'bg-green-50 text-green-600',MEDIUM:'bg-amber-50 text-amber-600',HIGH:'bg-orange-50 text-orange-600',CRITICAL:'bg-red-50 text-red-600'}; return m[s]||'' }
function statusColor(s: string) { const m: Record<string,string>={ACTIVE:'bg-green-50 text-green-600',PROSPECT:'bg-blue-50 text-blue-600',INACTIVE:'bg-gray-100 text-gray-500',ARCHIVED:'bg-gray-100 text-gray-400'}; return m[s]||'' }

/* ── Main ─────────────────────────────────────── */

export default function ClientsPage() {
  const [view, setView] = useState<'list'|'detail'>('list')
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [clients, setClients] = useState<ClientItem[]>([])
  const [stats, setStats] = useState({active:0,prospect:0,highRisk:0})
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState(''); const [filterRisk, setFilterRisk] = useState(''); const [searchQ, setSearchQ] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    try { const f: Record<string,string>={limit:'50'}; if(filterStatus)f.status=filterStatus; if(filterRisk)f.risk_level=filterRisk; if(searchQ)f.q=searchQ
      const r = await window.harbor.invoke<{items:ClientItem[];total:number;stats:{active:number;prospect:number;highRisk:number}}>('clients:list',f)
      setClients(r.items); setTotal(r.total); setStats(r.stats)
    } catch(e){} finally { setLoading(false) }
  },[filterStatus,filterRisk,searchQ])

  useEffect(()=>{loadList()},[loadList])

  return (
    <div>
      {view==='list' ? (
        <div>
          <div className="mb-6 flex items-center justify-between"><div><h2 className="text-[17px] font-bold text-gray-900">客户列表</h2><p className="text-[13px] text-gray-400 mt-0.5">共 {total} 个客户</p></div>
            <div className="flex gap-2">{stats.active>0&&<span className="rounded-full bg-green-50 px-3 py-1 text-[11px] text-green-600">{stats.active} 活跃</span>}{stats.prospect>0&&<span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] text-blue-600">{stats.prospect} 潜在</span>}{stats.highRisk>0&&<span className="rounded-full bg-red-50 px-3 py-1 text-[11px] text-red-600">{stats.highRisk} 高风险</span>}</div>
          </div>
          <div className="flex gap-3 mb-5 flex-wrap"><input type="text" placeholder="搜索公司名、海关编码..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} className="w-56 rounded-xl border border-gray-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-harbor-300" />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-harbor-300 bg-white"><option value="">全部状态</option>{STATUS_OPTS.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select>
            <select value={filterRisk} onChange={e=>setFilterRisk(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-harbor-300 bg-white"><option value="">全部风险</option>{RISK_OPTS.map(r=><option key={r} value={r}>{riskLabel(r)}</option>)}</select>
          </div>
          {loading? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-5"><div className="h-4 w-48 rounded bg-gray-100"/></div>)}</div>
          : clients.length===0? <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center"><p className="text-[15px] text-gray-400">暂无客户数据</p></div>
          : <div className="space-y-2">{clients.map(c=>(<button key={c.id} onClick={()=>{setSelectedId(c.id);setView('detail')}} className="w-full text-left rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 hover:shadow-sm transition-all duration-200"><div className="flex items-center justify-between"><div className="flex items-center gap-3 min-w-0"><span className="text-[14px] font-semibold text-gray-900">{c.company_name}</span>{c.company_name_en&&<span className="text-[12px] text-gray-400">{c.company_name_en}</span>}</div><div className="flex items-center gap-2 shrink-0">{c.country&&<span className="text-[12px] text-gray-400">{c.country}</span>}{c.industry&&<><span className="text-gray-300">·</span><span className="text-[12px] text-gray-400">{c.industry}</span></>}<span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',statusColor(c.status))}>{statusLabel(c.status)}</span><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',riskColor(c.risk_level))}>{riskLabel(c.risk_level)}</span></div></div></button>))}</div>}
        </div>
      ) : selectedId && <ClientDetailView clientId={selectedId} onBack={()=>{setView('list');setSelectedId(null)}} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CLIENT DETAIL VIEW
   ═══════════════════════════════════════════════════ */

function ClientDetailView({clientId,onBack}:{clientId:string;onBack:()=>void}){
  const [detail,setDetail]=useState<ClientDetail|null>(null); const [loading,setLoading]=useState(true); const [activeTab,setActiveTab]=useState<Tab>('概览')
  const [health,setHealth]=useState<{score:number;factors:string[];maxScore:number}|null>(null)

  const load=useCallback(async()=>{setLoading(true)
    try{const d=await window.harbor.invoke<ClientDetail|null>('clients:getById',clientId); setDetail(d)
      const h=await window.harbor.invoke<{score:number;factors:string[];maxScore:number}|null>('clients:getHealthScore',clientId); setHealth(h)
    }catch(e){}finally{setLoading(false)}
  },[clientId])

  useEffect(()=>{load()},[load])

  if(loading)return <div className="animate-pulse space-y-5"><button onClick={onBack} className="text-[13px] text-gray-400">← 返回列表</button><div className="rounded-2xl border border-gray-100 p-6"><div className="h-6 w-48 rounded bg-gray-100"/></div></div>
  if(!detail)return <div className="text-center py-16 text-gray-400">客户未找到</div>

  return <div className="flex gap-6"><div className="flex-1 min-w-0">
    <button onClick={onBack} className="text-[13px] text-gray-400 hover:text-gray-600 mb-3 transition-colors">← 返回列表</button>
    <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-5">
      <div className="flex items-start justify-between"><div>
        <div className="flex items-center gap-3 mb-2"><h2 className="text-[18px] font-bold text-gray-900">{detail.company_name}</h2>{detail.company_name_en&&<span className="text-[13px] text-gray-400">{detail.company_name_en}</span>}<span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium',statusColor(detail.status))}>{statusLabel(detail.status)}</span><span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium',riskColor(detail.risk_level))}>风险: {riskLabel(detail.risk_level)}</span></div>
        <div className="flex items-center gap-3 text-[13px] text-gray-500">{detail.country&&<span>{detail.country}</span>}{detail.industry&&<><span className="text-gray-300">·</span><span>{detail.industry}</span></>}{detail.customs_code&&<><span className="text-gray-300">·</span><span className="font-mono">{detail.customs_code}</span></>}{detail.customs_grade&&<><span className="text-gray-300">·</span><span>{detail.customs_grade}</span></>}{detail.account_manager_name&&<><span className="text-gray-300">·</span><span>👤 {detail.account_manager_name}</span></>}</div>
      </div>
      <div className="flex items-center gap-2"><button onClick={async()=>{const d=await window.harbor.invoke<Record<string,unknown>|null>('clients:export',detail.id); if(d){const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${detail.company_name}.json`;a.click()}}} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors">📥 导出</button><button onClick={()=>{if(confirm('确定要归档此客户吗？')){window.harbor.invoke('clients:archive',detail.id);onBack()}}} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">📦 归档</button></div></div>
    </div>
    <div className="flex gap-1 mb-5 border-b border-gray-100">{TABS.map(t=><button key={t} onClick={()=>setActiveTab(t)} className={cn('px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px]',activeTab===t?'border-harbor-600 text-harbor-700':'border-transparent text-gray-400 hover:text-gray-600')}>{t}</button>)}</div>
    <div className="min-h-[400px]">{activeTab==='概览'&&<OverviewTab detail={detail}/>}{activeTab==='联系人'&&<ContactsTab clientId={clientId} contacts={detail.contacts} onUpdate={load}/>}{activeTab==='案件'&&<CasesTab cases={detail.cases||[]}/>}{activeTab==='沟通'&&<CommsTab comms={detail.communications||[]}/>}{activeTab==='文件'&&<DocsTab docs={detail.documents||[]}/>}{activeTab==='健康'&&<HealthTab health={health} detail={detail}/>}</div>
  </div>
  <AIPanel detail={detail} health={health} onUpdate={load} /></div>
}

/* ── Tab: Overview ─────────────────────────────── */
function OverviewTab({detail}:{detail:ClientDetail}){return <div className="space-y-5">
  <InfoCard title="公司信息" icon="🏢"><InfoRow label="公司名称" value={detail.company_name}/><InfoRow label="英文名称" value={detail.company_name_en}/><InfoRow label="法定名称" value={detail.legal_name}/><InfoRow label="国家" value={detail.country}/><InfoRow label="网址" value={detail.website}/><InfoRow label="行业" value={detail.industry}/></InfoCard>
  <InfoCard title="注册信息" icon="📋"><InfoRow label="税号" value={detail.tax_number} mono/><InfoRow label="注册号" value={detail.registration_number} mono/><InfoRow label="海关编码" value={detail.customs_code} mono/><InfoRow label="海关等级" value={detail.customs_grade}/><InfoRow label="地址" value={detail.address}/></InfoCard>
  <InfoCard title="偏好设置" icon="⚙️"><InfoRow label="语言" value={detail.preferred_language}/><InfoRow label="备注" value={detail.notes}/></InfoCard>
  {detail.tags&&detail.tags.length>0&&<div className="flex gap-1.5">{detail.tags.map((t,i)=><span key={i} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-500">{t}</span>)}</div>}
</div>}

/* ── Tab: Contacts ─────────────────────────────── */
function ContactsTab({clientId,contacts,onUpdate}:{clientId:string;contacts:Contact[];onUpdate:()=>void}){
  const [showAdd,setShowAdd]=useState(false)
  return <div className="space-y-3">
    <button onClick={()=>setShowAdd(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-gray-800 transition-colors">+ 添加联系人</button>
    {contacts.length===0?<p className="text-[13px] text-gray-400 py-4">暂无联系人</p>:contacts.map(c=><div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors"><div className="flex items-center justify-between"><div><span className="text-[14px] font-medium text-gray-800">{c.name}</span>{c.is_primary?<span className="ml-2 rounded-full bg-harbor-50 px-2 py-0.5 text-[10px] text-harbor-600">主要</span>:null}<div className="flex items-center gap-3 mt-1 text-[12px] text-gray-500">{c.position&&<span>{c.position}</span>}{c.department&&<><span className="text-gray-300">·</span><span>{c.department}</span></>}{c.email&&<><span className="text-gray-300">·</span><span>{c.email}</span></>}{c.phone&&<><span className="text-gray-300">·</span><span>{c.phone}</span></>}</div></div><button onClick={async()=>{await window.harbor.invoke('clients:deleteContact',c.id);onUpdate()}} className="text-xs text-gray-400 hover:text-red-500">删除</button></div></div>)}
    {showAdd&&<AddContactModal clientId={clientId} onClose={()=>setShowAdd(false)} onAdded={()=>{setShowAdd(false);onUpdate()}}/>}
  </div>
}

function AddContactModal({clientId,onClose,onAdded}:{clientId:string;onClose:()=>void;onAdded:()=>void}){
  const [name,setName]=useState(''); const [position,setPosition]=useState(''); const [email,setEmail]=useState(''); const [phone,setPhone]=useState(''); const [saving,setSaving]=useState(false)
  const save=async()=>{if(!name.trim())return;setSaving(true);await window.harbor.invoke('clients:addContact',clientId,{name:name.trim(),position:position.trim()||null,email:email.trim()||null,phone:phone.trim()||null,isPrimary:false});setSaving(false);onAdded()}
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4"><h3 className="text-[16px] font-bold text-gray-900 mb-4">添加联系人</h3><div className="space-y-3"><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="姓名" autoFocus className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/><input type="text" value={position} onChange={e=>setPosition(e.target.value)} placeholder="职位" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/><input type="text" value={email} onChange={e=>setEmail(e.target.value)} placeholder="邮箱" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/><input type="text" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="电话" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500"/><div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] text-gray-500">取消</button><button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-[13px] font-medium text-white">保存</button></div></div></div></div>
}

/* ── Tab: Cases ────────────────────────────────── */
function CasesTab({cases}:{cases:any[]}){if(cases.length===0)return <p className="text-[13px] text-gray-400 py-4">暂无关联案件</p>
  return <div className="space-y-2">{cases.map((c:any)=><div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="font-mono text-[13px] font-semibold text-gray-900">{c.case_no}</span><span className="text-[12px] text-gray-500">{c.status}</span><span className="text-[12px] text-gray-400">{c.type==='IMPORT'?'进口':'出口'}</span></div><span className="text-[12px] text-gray-400">{c.bill_of_lading||''}</span></div></div>)}</div>}

/* ── Tab: Communications ───────────────────────── */
function CommsTab({comms}:{comms:any[]}){if(comms.length===0)return <p className="text-[13px] text-gray-400 py-4">暂无关联沟通</p>
  const icons:Record<string,string>={EMAIL:'📧',PHONE_CALL:'📞',MEETING:'🤝',WECHAT:'💬',MANUAL:'📝'}
  return <div className="space-y-2">{comms.map((c:any)=><div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4"><div className="flex items-center gap-3"><span>{icons[c.comm_type]||'📎'}</span><span className="text-[13px] text-gray-700 flex-1">{c.subject||c.from_name||'(无主题)'}</span><span className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString('zh-CN')}</span></div></div>)}</div>}

/* ── Tab: Documents ────────────────────────────── */
function DocsTab({docs}:{docs:any[]}){if(docs.length===0)return <p className="text-[13px] text-gray-400 py-4">暂无关联文件</p>
  return <div className="space-y-2">{docs.map((d:any)=><div key={d.id} className="rounded-xl border border-gray-100 bg-white p-4"><div className="flex items-center gap-3"><span>📄</span><span className="text-[13px] text-gray-700 flex-1">{d.filename}</span><span className="text-[11px] text-gray-400">{d.ocr_status}</span></div></div>)}</div>}

/* ── Tab: Health ───────────────────────────────── */
function HealthTab({health,detail}:{health:{score:number;factors:string[];maxScore:number}|null;detail:ClientDetail}){
  if(!health)return <p className="text-[13px] text-gray-400 py-4">计算中...</p>
  const pct=Math.round(health.score/health.maxScore*100); const color=pct>=80?'text-green-600':pct>=60?'text-amber-600':'text-red-500'
  return <div className="space-y-5"><div className="rounded-2xl border border-gray-100 bg-white p-6 text-center"><p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">客户健康分数</p>
    <div className="relative inline-flex items-center justify-center"><svg className="w-24 h-24 transform -rotate-90"><circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8"/><circle cx="48" cy="48" r="40" fill="none" stroke={pct>=80?'#16a34a':pct>=60?'#d97706':'#ef4444'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct*2.51} 251`}/></svg><span className={cn('absolute text-[22px] font-bold',color)}>{health.score}</span></div><p className={cn('text-[13px] font-medium mt-2',color)}>{health.score}/{health.maxScore}</p>
    <div className="mt-4 text-left space-y-1">{health.factors.map((f,i)=><p key={i} className="text-[12px] text-gray-600">• {f}</p>)}</div></div>
  </div>
}

/* ── AI Panel ──────────────────────────────────── */
function AIPanel({detail,health,onUpdate}:{detail:ClientDetail;health:{score:number;factors:string[];maxScore:number}|null;onUpdate:()=>void}){
  const [collapsed,setCollapsed]=useState(false)
  return <div className={cn('shrink-0 transition-all duration-200',collapsed?'w-10':'w-[280px]')}>
    <button onClick={()=>setCollapsed(!collapsed)} className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-br from-harbor-50 to-white border border-harbor-100 p-3 mb-3"><span className="text-[12px] font-semibold text-harbor-700">🤖 AI 助手</span><span className="text-[11px] text-harbor-400">{collapsed?'◀':'▶'}</span></button>
    {!collapsed&&<div className="space-y-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">客户摘要</p><p className="text-[13px] text-gray-600 leading-relaxed">{detail.company_name}，{detail.industry||'未知行业'}，{detail.country||'未知地区'}。{detail.activeCaseCount} 个活跃案件{health&&`，健康分数 ${health.score}/100`}。</p></div>
      <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">建议操作</p><div className="space-y-2">{detail.contacts.length===0&&<SItem text="添加联系人"/>}{!detail.customs_code&&<SItem text="补充海关编码"/>}{detail.activeCaseCount===0&&<SItem text="创建第一个案件"/>}{detail.risk_level==='HIGH'||detail.risk_level==='CRITICAL'?<SItem text="降低风险等级"/>:null}<SItem text="检查文件完整性"/></div></div>
    </div>}
  </div>
}
function SItem({text}:{text:string}){return <div className="flex items-center gap-2 text-[13px] text-gray-600"><span className="text-harbor-500">•</span><span>{text}</span></div>}

/* ── Shared Components ─────────────────────────── */
function InfoCard({title,icon,children}:{title:string;icon:string;children:React.ReactNode}){return <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden"><div className="px-5 py-3 border-b border-gray-50"><h3 className="text-[13px] font-semibold text-gray-700">{icon} {title}</h3></div><div className="p-5 grid grid-cols-2 gap-x-8 gap-y-2.5">{children}</div></div>}
function InfoRow({label,value,mono}:{label:string;value:string|null|undefined;mono?:boolean}){return <div className="flex items-baseline gap-2"><span className="text-[12px] text-gray-400 shrink-0">{label}</span><span className={cn('text-[13px] text-gray-700',mono&&'font-mono')}>{value||'—'}</span></div>}
