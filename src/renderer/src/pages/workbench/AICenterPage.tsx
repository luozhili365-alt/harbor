import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

/* ── Types ─────────────────────────────────────── */
interface MissionData { activeCases: number; unreadEmails: number; criticalTasks: number; overdueItems: number; todayReminders: number; pendingSuggestions: number; todayShipments: number; todayInspections: number; focus: string[] }
interface Suggestion { module: string; title: string; description: string; confidence: number; action: string; case_no?: string; client_name?: string }

/* ── Main ─────────────────────────────────────── */
export default function AICenterPage() {
  const user = JSON.parse(localStorage.getItem('harbor_user') || '{"name":"用户"}')
  const [mission, setMission] = useState<MissionData|null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{role:string;text:string}>>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [activeView, setActiveView] = useState<'mission'|'suggestions'|'chat'>('mission')

  const greeting = (() => {
    const h = new Date().getHours()
    const g = h<12?'早上好':h<18?'下午好':'晚上好'
    return `${g}，${user.name || '欢迎回来'}`
  })()

  const load = useCallback(async () => {
    try {
      const m = await window.harbor.invoke<MissionData>('ai:getMissionControl')
      setMission(m)
      const s = await window.harbor.invoke<{suggestions:Suggestion[]}>('ai:getSuggestions')
      setSuggestions(s.suggestions)
    } catch(e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleChat = async () => {
    if (!chatInput.trim()) return
    const q = chatInput.trim()
    setChatHistory(h => [...h, {role:'user',text:q}])
    setChatInput(''); setChatLoading(true)
    try {
      const r = await window.harbor.invoke<{response:string}>('ai:chat', q)
      setChatHistory(h => [...h, {role:'ai',text:r.response}])
    } catch(e) { setChatHistory(h => [...h, {role:'ai',text:'抱歉，处理请求时出错。'}]) }
    finally { setChatLoading(false) }
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[200px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4">
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">AI 指挥中心</p>
          <div className="space-y-0.5">
            <NavBtn icon="📊" label="任务控制" active={activeView==='mission'} onClick={()=>setActiveView('mission')} />
            <NavBtn icon="💡" label="AI 建议" active={activeView==='suggestions'} onClick={()=>setActiveView('suggestions')} count={suggestions.length} />
            <NavBtn icon="💬" label="AI 对话" active={activeView==='chat'} onClick={()=>setActiveView('chat')} />
          </div>
        </div>
        {mission && (
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] text-gray-400 mb-2">快速统计</p>
            <div className="space-y-1 text-[11px]">{mission.activeCases>0&&<p className="text-gray-600">📋 {mission.activeCases} 活跃案件</p>}{mission.criticalTasks>0&&<p className="text-red-500">⚠ {mission.criticalTasks} 严重</p>}{mission.overdueItems>0&&<p className="text-gray-500">⏰ {mission.overdueItems} 逾期</p>}{mission.todayShipments>0&&<p className="text-blue-500">🚢 {mission.todayShipments} 货物</p>}</div>
          </div>
        )}
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 overflow-y-auto border-r border-gray-100">
        {activeView === 'mission' && (
          <div className="p-8 space-y-8">
            {/* ── MISSION CONTROL HEADER ── */}
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 text-white">
              <h1 className="text-[24px] font-bold tracking-tight">{greeting}</h1>
              <p className="text-[14px] text-gray-400 mt-1">今日运维概览</p>
              <div className="grid grid-cols-4 gap-4 mt-6">
                <MCStat label="活跃案件" value={mission?.activeCases??0} />
                <MCStat label="未读邮件" value={mission?.unreadEmails??0} />
                <MCStat label="严重任务" value={mission?.criticalTasks??0} color="text-red-400" />
                <MCStat label="逾期项目" value={mission?.overdueItems??0} color="text-amber-400" />
                <MCStat label="今日提醒" value={mission?.todayReminders??0} />
                <MCStat label="今日货物" value={mission?.todayShipments??0} color="text-blue-400" />
                <MCStat label="今日查验" value={mission?.todayInspections??0} color="text-orange-400" />
                <MCStat label="AI 待处理" value={mission?.pendingSuggestions??0} color="text-purple-400" />
              </div>
              {mission?.focus && mission.focus.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">今日重点</p>
                  <div className="space-y-1.5">
                    {mission.focus.map((f,i) => <p key={i} className="text-[14px] text-gray-300">{['①','②','③','④','⑤'][i]} {f}</p>)}
                  </div>
                </div>
              )}
            </div>

            {/* ── AI SUGGESTIONS PREVIEW ── */}
            {suggestions.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <h3 className="text-[15px] font-bold text-gray-900 mb-4">💡 跨模块 AI 建议 ({suggestions.length})</h3>
                <div className="space-y-2">
                  {suggestions.slice(0,6).map((s,i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-50 bg-gray-50/30 px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 shrink-0">{s.module}</span>
                      <span className="text-[13px] text-gray-700 flex-1 truncate">{s.title}</span>
                      <span className={cn('text-[10px]',s.confidence>=0.9?'text-green-500':s.confidence>=0.8?'text-amber-500':'text-red-400')}>{Math.round(s.confidence*100)}%</span>
                      <button className="rounded-md bg-harbor-600 px-2.5 py-1 text-[10px] text-white hover:bg-harbor-700 shrink-0">处理</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'suggestions' && (
          <div className="p-8">
            <h2 className="text-[17px] font-bold text-gray-900 mb-6">💡 统一 AI 建议</h2>
            <p className="text-[13px] text-gray-400 mb-6">汇集来自所有模块的 AI 建议。无需在各模块间切换。</p>
            {suggestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center"><p className="text-[15px] text-gray-400">暂无 AI 建议</p><p className="text-[13px] text-gray-300 mt-1">随着业务数据增加，AI 会生成更多建议</p></div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s,i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">{s.module}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', s.confidence>=0.9?'bg-green-50 text-green-600':s.confidence>=0.8?'bg-amber-50 text-amber-600':'bg-red-50 text-red-500')}>置信度 {Math.round(s.confidence*100)}%</span>
                      </div>
                    </div>
                    <h4 className="text-[14px] font-semibold text-gray-900">{s.title}</h4>
                    <p className="text-[13px] text-gray-500 mt-1">{s.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button className="rounded-lg bg-harbor-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-harbor-700">✓ {s.action}</button>
                      <button className="rounded-lg px-3 py-1.5 text-[12px] text-gray-400 hover:bg-gray-50">忽略</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {chatHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="text-[15px] font-semibold text-gray-700 mb-2">AI 自然语言助手</h3>
                  <p className="text-[13px] text-gray-400 mb-6">试试以下命令:</p>
                  <div className="space-y-2 max-w-md mx-auto">
                    {['查询延迟货物','哪些客户需要跟进？','生成今日运维摘要','查找发票文件','有哪些缺失文件？'].map((q,i) => (
                      <button key={i} onClick={()=>{setChatInput(q);handleChat()}} className="w-full rounded-xl border border-gray-100 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors text-left">{q}</button>
                    ))}
                  </div>
                </div>
              ) : chatHistory.map((m,i) => (
                <div key={i} className={cn('flex', m.role==='user'?'justify-end':'justify-start')}>
                  <div className={cn('max-w-[80%] rounded-2xl px-5 py-3', m.role==='user'?'bg-harbor-600 text-white':'bg-gray-100 text-gray-700')}>
                    <p className="text-[13px] whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-gray-100 rounded-2xl px-5 py-3"><p className="text-[13px] text-gray-400">思考中...</p></div></div>}
            </div>
            <div className="shrink-0 border-t border-gray-100 p-4">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleChat()}}
                  placeholder="输入自然语言查询..." className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-harbor-500"/>
                <button onClick={handleChat} disabled={chatLoading} className="rounded-xl bg-gray-900 px-5 py-3 text-[13px] font-medium text-white hover:bg-gray-800 disabled:opacity-50">发送</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-[260px] shrink-0 overflow-y-auto bg-white p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">⚠️ 隐私声明</p>
        <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4 mb-4">
          <p className="text-[12px] text-amber-700 leading-relaxed">
            Harbor AI 不会监听电话、监控微信、读取私人通讯。所有建议基于你主动导入的业务数据生成。AI 建议需要你确认才会执行。
          </p>
        </div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">🎯 核心原则</p>
        <div className="space-y-2 text-[12px] text-gray-500">
          <p>• AI 推荐，人类决策</p>
          <p>• 所有建议显示置信度</p>
          <p>• 所有操作记录审计日志</p>
          <p>• 绝不自动执行业务操作</p>
          <p>• 绝不自动发送邮件</p>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ────────────────────────────── */

function MCStat({label,value,color}:{label:string;value:number;color?:string}){ return <div className="rounded-xl bg-white/5 px-4 py-3"><p className={cn('text-[22px] font-bold tabular-nums',color||'text-white')}>{value}</p><p className="text-[11px] text-gray-500 mt-0.5">{label}</p></div> }
function NavBtn({icon,label,active,onClick,count}:{icon:string;label:string;active:boolean;onClick:()=>void;count?:number}){ return <button onClick={onClick} className={cn('w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors',active?'bg-gray-100 text-gray-900 font-medium':'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}><span>{icon}</span><span className="flex-1 text-left">{label}</span>{count!=null&&count>0&&<span className="rounded-full bg-harbor-100 px-1.5 py-0.5 text-[10px] text-harbor-600">{count}</span>}</button> }
