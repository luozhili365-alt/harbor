import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'
import CasesPage from './CasesPage'
import ClientsPage from './ClientsPage'
import InboxPage from './InboxPage'
import MailboxSettings from './MailboxSettings'
import DocumentsPage from './DocumentsPage'
import ReminderPage from './ReminderPage'
import ProfileDropdown from './ProfileDropdown'

/* ── Types ─────────────────────────────────────── */

interface WorkbenchProps {
  user: { id: string; name: string; email: string; role: string }
  onLogout: () => void
}

interface Stats {
  activeCases: number
  unreadEmails: number
  pendingTasks: number
  completedThisMonth: number
  overdueTasks: number
  casesByStatus: Record<string, number>
}

interface AttentionItem {
  id: string
  case_no?: string | null
  company_name?: string | null
  status?: string | null
  title?: string
  due_date?: string
  priority?: string
  task_type?: string
}

interface AttentionData {
  customsQueries: Array<{
    id: string; subject: string | null; ai_summary: string | null
    linked_case_id: string | null; received_at: string
    case_no: string | null; status: string | null; company_name: string | null
  }>
  needsReview: Array<{
    id: string; case_no: string; status: string; company_name: string | null
    item_count: number; avg_confidence: number | null
  }>
  stalled: Array<{
    id: string; case_no: string; status: string; company_name: string | null
    last_activity: string | null; days_stalled: number
  }>
  upcomingDeadlines: Array<{
    id: string; title: string; due_date: string; priority: string
    task_type: string; case_no: string | null; case_id: string | null; company_name: string | null
  }>
  recentlyCleared: Array<{
    id: string; case_no: string; type: string; company_name: string | null; cleared_at: string | null
  }>
}

interface DailyBriefing {
  activeCases: number
  todayDeadlines: number
  missingDocs: number
  highRiskCases: number
  recommendations: string[]
  nextBestAction: {
    type: 'customs_query' | 'stalled_case'
    title: string
    reason: string
    case_no: string | null
    company_name: string | null
    case_id: string | null
  } | null
}

interface TaskItem {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string
  case_id: string | null
  case_no: string | null
  client_name: string | null
  created_at: string
}

/* ── Helpers ───────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function getMotivation(): string {
  const quotes = [
    '专注今天，一件一件来。',
    '清晰的优先级带来平静的工作状态。',
    '你今天的工作将为客户创造价值。',
    '保持节奏，高效通关。',
  ]
  return quotes[new Date().getDay() % quotes.length]
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function deadlineLabel(days: number): { label: string; color: string } {
  if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, color: 'text-red-500' }
  if (days === 0) return { label: '今天', color: 'text-red-500' }
  if (days === 1) return { label: '明天', color: 'text-amber-600' }
  if (days <= 7) return { label: '本周', color: 'text-amber-500' }
  if (days <= 30) return { label: '本月', color: 'text-gray-500' }
  return { label: '未来', color: 'text-gray-400' }
}

function priorityBg(p: string): string {
  switch (p) {
    case 'URGENT': return 'bg-red-50 text-red-600'
    case 'HIGH': return 'bg-orange-50 text-orange-600'
    case 'NORMAL': return 'bg-blue-50 text-blue-600'
    case 'LOW': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function priorityLabel(p: string): string {
  switch (p) {
    case 'URGENT': return '紧急'
    case 'HIGH': return '高'
    case 'NORMAL': return '普通'
    case 'LOW': return '低'
    default: return p
  }
}

/* ── Main Component ────────────────────────────── */

export default function WorkbenchPage({ user, onLogout }: WorkbenchProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [attention, setAttention] = useState<AttentionData | null>(null)
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)

  // Sidebar
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [sidebarLocked, setSidebarLocked] = useState(false)
  const sidebarExpanded = sidebarHovered || sidebarLocked

  // Page routing
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'inbox' | 'cases' | 'clients' | 'documents' | 'reminders' | 'settings'>('dashboard')

  // Quick Add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Mission Control + AI Chat
  const [mission, setMission] = useState<{activeCases:number;unreadEmails:number;criticalTasks:number;overdueItems:number;todayReminders:number;pendingSuggestions:number;todayShipments:number;todayInspections:number;focus:string[]}|null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{role:string;text:string}>>([])
  const [chatLoading, setChatLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, a, b, t, m] = await Promise.all([
        window.harbor.invoke<Stats>('dashboard:getStats'),
        window.harbor.invoke<AttentionData>('dashboard:getAttentionItems'),
        window.harbor.invoke<DailyBriefing>('dashboard:getDailyBriefing'),
        window.harbor.invoke<{ items: TaskItem[]; total: number }>('tasks:list', user.id, { status: 'PENDING', limit: '15' }),
        window.harbor.invoke<{activeCases:number;unreadEmails:number;criticalTasks:number;overdueItems:number;todayReminders:number;pendingSuggestions:number;todayShipments:number;todayInspections:number;focus:string[]}|null>('ai:getMissionControl'),
      ])
      setStats(s)
      setAttention(a)
      setBriefing(b)
      setTasks(t.items)
      setMission(m)
    } catch (err) {
      console.error('[Workbench] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  const handleAIChat = async () => {
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

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleTaskCreated = (t: TaskItem) => {
    setTasks(prev => [t, ...prev])
    setShowQuickAdd(false)
  }

  const handleTaskComplete = async (taskId: string) => {
    await window.harbor.invoke('tasks:complete', taskId, user.id)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleTaskDelete = async (taskId: string) => {
    await window.harbor.invoke('tasks:delete', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleDismissAI = (id: string) => {
    // For now, just remove from local state (future: persist dismissal)
    setAttention(prev => prev ? {
      ...prev,
      customsQueries: prev.customsQueries.filter(q => q.id !== id),
      needsReview: prev.needsReview.filter(r => r.id !== id),
      stalled: prev.stalled.filter(s => s.id !== id),
    } : null)
  }

  /* ── Render ──────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa]">
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-full flex flex-col border-r border-gray-100 bg-white transition-all duration-200 ease-out pt-10',
          sidebarExpanded ? 'w-52' : 'w-[52px]'
        )}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        <div className={cn(
          'flex h-12 items-center border-b border-gray-50 px-3.5',
          sidebarExpanded ? 'gap-3' : 'justify-center'
        )}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-harbor-600 text-white text-xs font-bold">
            H
          </div>
          {sidebarExpanded && <span className="text-sm font-semibold text-gray-800">Harbor</span>}
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          <NavItem icon="⚡" label="工作台" expanded={sidebarExpanded} active={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} />
          <NavItem icon="📥" label="收件箱" expanded={sidebarExpanded} active={currentPage === 'inbox'} onClick={() => setCurrentPage('inbox')} />
          <NavItem icon="📋" label="案件" expanded={sidebarExpanded} active={currentPage === 'cases'} onClick={() => setCurrentPage('cases')} />
          <NavItem icon="👥" label="客户" expanded={sidebarExpanded} active={currentPage === 'clients'} onClick={() => setCurrentPage('clients')} />
          <NavItem icon="📂" label="文件" expanded={sidebarExpanded} active={currentPage === 'documents'} onClick={() => setCurrentPage('documents')} />
          <NavItem icon="🔔" label="提醒" expanded={sidebarExpanded} active={currentPage === 'reminders'} onClick={() => setCurrentPage('reminders')} />
          <NavItem icon="⚙️" label="设置" expanded={sidebarExpanded} active={currentPage === 'settings'} onClick={() => setCurrentPage('settings')} />
        </nav>

        <div className="border-t border-gray-50 p-2">
          <button
            onClick={() => setSidebarLocked(!sidebarLocked)}
            className={cn(
              'w-full rounded-lg p-2 text-xs text-gray-400 hover:bg-gray-50 transition-colors',
              sidebarExpanded ? 'text-left' : 'text-center'
            )}
            title={sidebarLocked ? '自动收起' : '固定侧边栏'}
          >
            {sidebarLocked ? '📌' : '📍'}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className={cn(
        'flex-1 overflow-y-auto transition-all duration-200 ease-out',
        sidebarExpanded ? 'ml-52' : 'ml-[52px]'
      )}>
        {/* ═══ HEADER ═══ */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-white/80 backdrop-blur-md px-8">
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-gray-400">
              {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-gray-500">{user.name}</span>
            <ProfileDropdown user={user} onLogout={onLogout} />
          </div>
        </header>

        {/* ═══ PAGE CONTENT ═══ */}
        {currentPage !== 'dashboard' ? (
          currentPage === 'inbox' ? (
            <InboxPage />
          ) : currentPage === 'documents' ? (
            <DocumentsPage />
          ) : currentPage === 'reminders' ? (
            <ReminderPage />
          ) : currentPage === 'settings' ? (
            <div className="mx-auto max-w-[960px] px-8 py-10">
              <MailboxSettings />
            </div>
          ) : (
            <div className="mx-auto max-w-[960px] px-8 py-10">
              {currentPage === 'cases' && <CasesPage />}
              {currentPage === 'clients' && <ClientsPage />}
            </div>
          )
        ) : loading ? (
          <div className="mx-auto max-w-[800px] px-8 py-16">
            <DashboardSkeleton />
          </div>
        ) : (
          <div className="mx-auto max-w-[800px] px-8 py-10 space-y-10">
            {/* ── HEADER GREETING ─────────────── */}
            <HomeHeader userName={user.name} />

            {/* ── GLOBAL SEARCH ────────────────── */}
            <GlobalSearchBar />

            {/* ── TODAY OVERVIEW ──────────────── */}
            <TodayOverview stats={stats} />

            {/* ── MISSION CONTROL ─────────────── */}
            {mission && (
              <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-white">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">📊 任务控制</p>
                <div className="grid grid-cols-4 gap-3">
                  <MCStat label="活跃案件" value={mission.activeCases} />
                  <MCStat label="未读邮件" value={mission.unreadEmails} />
                  <MCStat label="严重任务" value={mission.criticalTasks} color="text-red-400" />
                  <MCStat label="逾期项目" value={mission.overdueItems} color="text-amber-400" />
                  <MCStat label="今日提醒" value={mission.todayReminders} />
                  <MCStat label="今日货物" value={mission.todayShipments} color="text-blue-400" />
                  <MCStat label="今日查验" value={mission.todayInspections} color="text-orange-400" />
                  <MCStat label="AI 待处理" value={mission.pendingSuggestions} color="text-purple-400" />
                </div>
                {mission.focus.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-[10px] text-gray-500 mb-2">今日重点</p>
                    <div className="space-y-1">
                      {mission.focus.map((f,i) => <p key={i} className="text-[13px] text-gray-300">{['①','②','③'][i]} {f}</p>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── NEXT BEST ACTION ────────────── */}
            {briefing?.nextBestAction && (
              <NextBestAction action={briefing.nextBestAction} />
            )}

            {/* ── TODAY'S ACTIONS ─────────────── */}
            <TodayActions
              tasks={tasks}
              attention={attention}
              onQuickAdd={() => setShowQuickAdd(true)}
              onTaskComplete={handleTaskComplete}
              onTaskDelete={handleTaskDelete}
              onDismissAI={handleDismissAI}
            />

            {/* ── UPCOMING DEADLINES ──────────── */}
            {attention?.upcomingDeadlines && attention.upcomingDeadlines.length > 0 && (
              <UpcomingDeadlines deadlines={attention.upcomingDeadlines} />
            )}

            {/* ── AI DAILY BRIEFING ───────────── */}
            {briefing && (
              <AIDailyBriefing briefing={briefing} userName={user.name} stats={stats} />
            )}

            {/* ── AI CHAT ─────────────────────── */}
            <section className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="text-[13px] font-bold text-gray-900 mb-3">💬 AI 助手</h3>
              {chatHistory.length > 0 && (
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                  {chatHistory.map((m,i) => (
                    <div key={i} className={m.role==='user'?'flex justify-end':'flex justify-start'}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.role==='user'?'bg-harbor-600 text-white':'bg-gray-100 text-gray-700'}`}>
                        <p className="text-[13px] whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && <div className="text-[13px] text-gray-400">思考中...</div>}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleAIChat()}}
                  placeholder="试试: 查询延迟货物、哪些客户需要跟进？"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] outline-none focus:border-harbor-300"/>
                <button onClick={handleAIChat} disabled={chatLoading}
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50">发送</button>
              </div>
            </section>

            {/* ── EMPTY STATE ─────────────────── */}
            {!stats?.activeCases && !attention?.upcomingDeadlines?.length && tasks.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">☀️</div>
                <h3 className="text-[15px] font-semibold text-gray-700 mb-1">今天没有待办事项</h3>
                <p className="text-[13px] text-gray-400">
                  点击上方"+ 新建事项"开始规划今天的工作
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ QUICK ADD MODAL ═══ */}
      {showQuickAdd && (
        <QuickAddModal
          userId={user.id}
          onClose={() => setShowQuickAdd(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════ */

/* ── NavItem ───────────────────────────────────── */

function NavItem({ icon, label, expanded, active, onClick }: {
  icon: string; label: string; expanded: boolean; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center rounded-lg text-sm transition-all duration-200',
        expanded ? 'gap-3 px-3 py-2' : 'justify-center py-2.5',
        active
          ? 'bg-gray-50 text-harbor-700 font-medium'
          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
      )}
    >
      <span className="text-base shrink-0">{icon}</span>
      {expanded && <span className="text-[13px] truncate">{label}</span>}
    </button>
  )
}

/* ── MCStat ───────────────────────────────────── */
function MCStat({label,value,color}:{label:string;value:number;color?:string}){ return <div className="rounded-xl bg-white/5 px-3 py-2.5"><p className={cn('text-[20px] font-bold tabular-nums',color||'text-white')}>{value}</p><p className="text-[10px] text-gray-500 mt-0.5">{label}</p></div> }

/* ── HomeHeader ────────────────────────────────── */

function HomeHeader({ userName }: { userName: string }) {
  return (
    <div className="pt-2">
      <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
        {getGreeting()}，{userName}
      </h1>
      <p className="mt-1.5 text-[15px] text-gray-400">
        {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        <span className="mx-2 text-gray-200">·</span>
        {getMotivation()}
      </p>
    </div>
  )
}

/* ── GlobalSearchBar ───────────────────────────── */

function GlobalSearchBar() {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md cursor-text">
        <span className="text-lg text-gray-300">🔍</span>
        <input
          type="text"
          placeholder="搜索案件、客户、邮件、提单号..."
          className="flex-1 bg-transparent text-[15px] text-gray-700 placeholder:text-gray-300 outline-none"
          readOnly
        />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400 font-sans">
          <span>⌘</span><span>K</span>
        </kbd>
      </div>
    </div>
  )
}

/* ── TodayOverview ─────────────────────────────── */

function TodayOverview({ stats }: { stats: Stats | null }) {
  const cards = [
    { label: '活跃案件', value: stats?.activeCases ?? 0, icon: '📋', color: 'bg-blue-50 text-blue-600' },
    { label: '今日截止', value: stats?.pendingTasks ?? 0, icon: '⏰', color: 'bg-red-50 text-red-600' },
    { label: '未读邮件', value: stats?.unreadEmails ?? 0, icon: '✉️', color: 'bg-amber-50 text-amber-600' },
    { label: '待处理文件', value: '—', icon: '📄', color: 'bg-purple-50 text-purple-600' },
    { label: '高风险案件', value: '—', icon: '⚠️', color: 'bg-orange-50 text-orange-600' },
    { label: '本月完成', value: stats?.completedThisMonth ?? 0, icon: '✓', color: 'bg-green-50 text-green-600' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          className="rounded-2xl border border-gray-100 bg-white p-5 text-left hover:border-gray-200 hover:shadow-sm transition-all duration-200 group"
        >
          <div className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl text-base', c.color)}>
            {c.icon}
          </div>
          <p className="mt-3 text-[28px] font-bold text-gray-900 tracking-tight tabular-nums">
            {c.value}
          </p>
          <p className="mt-0.5 text-[13px] text-gray-400 group-hover:text-gray-500 transition-colors">
            {c.label}
          </p>
        </button>
      ))}
    </div>
  )
}

/* ── NextBestAction ────────────────────────────── */

function NextBestAction({ action }: { action: NonNullable<DailyBriefing['nextBestAction']> }) {
  return (
    <div className="rounded-2xl border border-harbor-100 bg-gradient-to-br from-harbor-50/60 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-harbor-600 text-white text-lg shadow-sm shadow-harbor-200">
          🎯
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-harbor-600 uppercase tracking-wider mb-1">
            下一步最佳行动
          </p>
          <h3 className="text-[15px] font-semibold text-gray-900">
            {action.title}
          </h3>
          {action.company_name && (
            <p className="text-[13px] text-gray-500 mt-0.5">{action.company_name}</p>
          )}
          <p className="mt-2 text-[13px] text-gray-500 leading-relaxed">
            {action.reason}
          </p>
          {action.case_id && (
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-harbor-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-harbor-700 transition-colors">
              打开案件 <span className="opacity-70">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── TodayActions ──────────────────────────────── */

function TodayActions({
  tasks, attention, onQuickAdd, onTaskComplete, onTaskDelete, onDismissAI,
}: {
  tasks: TaskItem[]
  attention: AttentionData | null
  onQuickAdd: () => void
  onTaskComplete: (id: string) => void
  onTaskDelete: (id: string) => void
  onDismissAI: (id: string) => void
}) {
  const [showCompleted, setShowCompleted] = useState(false)

  // Build AI action items from attention data
  const aiActions: Array<{ id: string; type: string; title: string; reason: string; priority: string; caseNo?: string | null; companyName?: string | null }> = []

  attention?.customsQueries.forEach(q => {
    aiActions.push({
      id: q.id, type: 'customs_query',
      title: q.subject || '海关查询',
      reason: q.ai_summary || '需要回复海关查询',
      priority: 'URGENT',
      caseNo: q.case_no, companyName: q.company_name,
    })
  })

  attention?.needsReview.forEach(r => {
    aiActions.push({
      id: r.id, type: 'needs_review',
      title: `审核案件 ${r.case_no}`,
      reason: `${r.item_count} 项商品需要审核 · HS 编码置信度 ${r.avg_confidence ? Math.round(r.avg_confidence * 100) + '%' : '未知'}`,
      priority: 'HIGH',
      caseNo: r.case_no, companyName: r.company_name,
    })
  })

  attention?.stalled.forEach(s => {
    aiActions.push({
      id: s.id, type: 'stalled',
      title: `案件 ${s.case_no} 已停滞`,
      reason: `已停滞 ${Math.round(s.days_stalled)} 天 · 最后活动: ${s.last_activity ? new Date(s.last_activity).toLocaleDateString('zh-CN') : '未知'}`,
      priority: 'HIGH',
      caseNo: s.case_no, companyName: s.company_name,
    })
  })

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">今日事项</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {aiActions.length + tasks.length} 项待处理
          </p>
        </div>
        <button
          onClick={onQuickAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-gray-800 transition-all duration-200 active:scale-[0.98]"
        >
          <span className="text-base">+</span>
          新建事项
        </button>
      </div>

      <div className="space-y-3">
        {/* AI Actions */}
        {aiActions.slice(0, 5).map(a => (
          <AIActionCard key={a.id} action={a} onDismiss={() => onDismissAI(a.id)} />
        ))}

        {/* Manual Tasks */}
        {tasks.map(t => (
          <MyActionCard
            key={t.id}
            task={t}
            onComplete={() => onTaskComplete(t.id)}
            onDelete={() => onTaskDelete(t.id)}
          />
        ))}
      </div>

      {/* Empty state for actions */}
      {aiActions.length === 0 && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-[15px] text-gray-400">暂无待办事项</p>
          <p className="text-[13px] text-gray-300 mt-1">
            AI 会根据邮件和案件自动生成建议 · 你也可以手动添加
          </p>
        </div>
      )}
    </section>
  )
}

/* ── AIActionCard ──────────────────────────────── */

function AIActionCard({ action, onDismiss }: {
  action: { id: string; type: string; title: string; reason: string; priority: string; caseNo?: string | null; companyName?: string | null }
  onDismiss: () => void
}) {
  return (
    <div className="group rounded-2xl border border-harbor-100 bg-gradient-to-r from-harbor-50/30 to-white p-5 hover:border-harbor-200 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        {/* AI badge */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-harbor-100 text-xs">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', priorityBg(action.priority))}>
              {priorityLabel(action.priority)}
            </span>
            <span className="text-[11px] text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
              AI 建议
            </span>
          </div>
          <h4 className="text-[15px] font-medium text-gray-900 mt-1">{action.title}</h4>
          {action.companyName && (
            <p className="text-[13px] text-gray-500 mt-0.5">{action.companyName}</p>
          )}
          <div className="mt-2 rounded-xl bg-white border border-gray-100 px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-gray-400 mb-0.5">原因</p>
            <p className="text-[13px] text-gray-600">{action.reason}</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {action.caseNo && (
              <button className="rounded-lg bg-harbor-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harbor-700 transition-colors">
                打开案件 →
              </button>
            )}
            <button
              onClick={onDismiss}
              className="rounded-lg px-3 py-1.5 text-[12px] text-gray-400 hover:bg-gray-100 hover:text-gray-500 transition-colors"
            >
              忽略
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── MyActionCard ──────────────────────────────── */

function MyActionCard({ task, onComplete, onDelete }: {
  task: TaskItem; onComplete: () => void; onDelete: () => void
}) {
  const overdue = new Date(task.due_date) < new Date()

  return (
    <div className="group rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onComplete}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-gray-200 hover:border-harbor-500 hover:bg-harbor-50 transition-colors"
          title="标记完成"
        />

        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] text-gray-800">{task.title}</h4>
          {task.description && (
            <p className="text-[13px] text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {task.priority !== 'NORMAL' && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', priorityBg(task.priority))}>
                {priorityLabel(task.priority)}
              </span>
            )}
            <span className={cn('text-[11px]', overdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
              {overdue ? `逾期 ${Math.abs(daysUntil(task.due_date))} 天` : deadlineLabel(daysUntil(task.due_date)).label}
            </span>
            {task.case_no && (
              <span className="text-[11px] text-gray-300">·</span>
            )}
            {task.case_no && (
              <span className="text-[11px] text-gray-400 font-mono">{task.case_no}</span>
            )}
            {task.client_name && (
              <span className="text-[11px] text-gray-400">{task.client_name}</span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 shrink-0 rounded-lg p-1.5 text-xs text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
          title="删除"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

/* ── UpcomingDeadlines ─────────────────────────── */

function UpcomingDeadlines({ deadlines }: { deadlines: AttentionData['upcomingDeadlines'] }) {
  const grouped: Record<string, AttentionData['upcomingDeadlines']> = {
    '逾期': [], '今天': [], '明天': [], '本周': [], '未来': [],
  }

  deadlines.forEach(d => {
    const days = daysUntil(d.due_date)
    if (days < 0) grouped['逾期'].push(d)
    else if (days === 0) grouped['今天'].push(d)
    else if (days === 1) grouped['明天'].push(d)
    else if (days <= 7) grouped['本周'].push(d)
    else grouped['未来'].push(d)
  })

  const nonEmpty = Object.entries(grouped).filter(([, items]) => items.length > 0)

  if (nonEmpty.length === 0) return null

  return (
    <section>
      <h2 className="text-[17px] font-bold text-gray-900 mb-5">即将到期</h2>
      <div className="space-y-5">
        {nonEmpty.map(([group, items]) => (
          <div key={group}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{group}</p>
            <div className="space-y-1">
              {items.map(d => {
                const dl = deadlineLabel(daysUntil(d.due_date))
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl px-4 py-2.5 hover:bg-white transition-colors group">
                    <span className={cn('text-[12px] w-10 shrink-0 text-right font-medium', dl.color)}>
                      {dl.label}
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0', priorityBg(d.priority))}>
                      {priorityLabel(d.priority)}
                    </span>
                    <span className="text-[14px] text-gray-700 truncate">{d.title}</span>
                    {d.case_no && (
                      <span className="text-[12px] text-gray-300 font-mono shrink-0 hidden sm:inline">{d.case_no}</span>
                    )}
                    {d.company_name && (
                      <span className="text-[12px] text-gray-400 truncate hidden sm:inline">{d.company_name}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── AIDailyBriefing ───────────────────────────── */

function AIDailyBriefing({ briefing, userName, stats }: {
  briefing: DailyBriefing; userName: string; stats: Stats | null
}) {
  const now = new Date()
  const hour = now.getHours()

  let timeContext = '开始今天的工作'
  if (hour < 10) timeContext = '开始今天的工作'
  else if (hour < 14) timeContext = '上午的工作进展如何'
  else if (hour < 18) timeContext = '下午好，继续加油'
  else timeContext = '今天辛苦了'

  return (
    <section className="rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-harbor-400 to-harbor-600 text-white text-lg shadow-sm shadow-harbor-200">
          ✨
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {getGreeting()}，{userName}。{timeContext}。
          </h2>
          <div className="mt-3 space-y-1.5">
            {stats && (
              <p className="text-[14px] text-gray-600 leading-relaxed">
                今天你有 <span className="font-semibold text-gray-900">{briefing.activeCases}</span> 个活跃案件
                {briefing.todayDeadlines > 0 && (
                  <><span className="text-gray-300">，</span><span className="font-semibold text-red-500">{briefing.todayDeadlines}</span> 个今日截止</>
                )}
                {briefing.missingDocs > 0 && (
                  <><span className="text-gray-300">，</span><span className="font-semibold text-amber-500">{briefing.missingDocs}</span> 份文件缺失</>
                )}
                。
              </p>
            )}
            {briefing.recommendations.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {briefing.recommendations.map((r, i) => (
                  <p key={i} className="text-[13px] text-gray-500 flex items-start gap-2">
                    <span className="text-harbor-500 mt-0.5">•</span>
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── QuickAddModal ─────────────────────────────── */

function QuickAddModal({ userId, onClose, onCreated }: {
  userId: string; onClose: () => void; onCreated: (t: TaskItem) => void
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const task = await window.harbor.invoke<TaskItem>('tasks:create', userId, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        priority,
        due_date: dueDate,
      })
      onCreated(task)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">新建事项</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="事项标题"
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] placeholder:text-gray-300 outline-none focus:border-harbor-500 focus:ring-2 focus:ring-harbor-50 transition-all"
            />
          </div>

          <div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="备注（可选）"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] placeholder:text-gray-300 outline-none focus:border-harbor-500 focus:ring-2 focus:ring-harbor-50 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">优先级</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white transition-all"
              >
                <option value="LOW">低</option>
                <option value="NORMAL">普通</option>
                <option value="HIGH">高</option>
                <option value="URGENT">紧急</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="w-full rounded-xl bg-gray-900 py-3 text-[14px] font-medium text-white hover:bg-gray-800 disabled:opacity-40 transition-all duration-200 active:scale-[0.99]"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── DashboardSkeleton ─────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-10">
      {/* Header */}
      <div className="space-y-3 pt-2">
        <div className="h-8 w-56 rounded-lg bg-gray-100" />
        <div className="h-4 w-72 rounded-lg bg-gray-50" />
      </div>
      {/* Search */}
      <div className="h-12 rounded-2xl bg-gray-50" />
      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-50 bg-white p-5">
            <div className="h-9 w-9 rounded-xl bg-gray-50" />
            <div className="mt-3 h-7 w-12 rounded bg-gray-50" />
            <div className="mt-1 h-3 w-16 rounded bg-gray-50" />
          </div>
        ))}
      </div>
      {/* Actions */}
      <div className="space-y-3">
        <div className="h-5 w-24 rounded bg-gray-100" />
        <div className="h-[100px] rounded-2xl bg-gray-50" />
        <div className="h-[72px] rounded-2xl bg-gray-50" />
      </div>
    </div>
  )
}
