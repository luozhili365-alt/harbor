import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerDashboardHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('dashboard:getStats', () => {
    const activeCases = (db.prepare(
      "SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND status NOT IN ('CLOSED', 'CANCELLED')"
    ).get() as { c: number }).c

    const unreadEmails = (db.prepare(
      "SELECT COUNT(*) as c FROM emails WHERE direction = 'INBOUND' AND status = 'UNREAD'"
    ).get() as { c: number }).c

    const pendingTasks = (db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE deleted_at IS NULL AND status = 'PENDING'"
    ).get() as { c: number }).c

    const completedThisMonth = (db.prepare(
      "SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND status = 'CLOSED' AND closed_at >= date('now', 'start of month')"
    ).get() as { c: number }).c

    const overdueTasks = (db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE deleted_at IS NULL AND status = 'PENDING' AND due_date < datetime('now')"
    ).get() as { c: number }).c

    const statusRows = db.prepare(
      'SELECT status, COUNT(*) as count FROM cases WHERE deleted_at IS NULL GROUP BY status'
    ).all() as { status: string; count: number }[]

    const casesByStatus: Record<string, number> = {}
    for (const row of statusRows) {
      casesByStatus[row.status] = row.count
    }

    return {
      activeCases,
      unreadEmails,
      pendingTasks,
      completedThisMonth,
      overdueTasks,
      casesByStatus
    }
  })

  ipcMain.handle('dashboard:getAttentionItems', () => {
    // Urgent customs queries
    const customsQueries = db.prepare(
      `SELECT e.id, e.subject, e.ai_summary, e.linked_case_id, e.received_at,
              c.case_no, c.status, cl.company_name
       FROM emails e
       LEFT JOIN cases c ON e.linked_case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE e.ai_category = 'CUSTOMS_QUERY'
         AND e.status IN ('UNREAD', 'READ')
         AND e.ai_priority IN ('HIGH', 'URGENT')
       ORDER BY e.received_at DESC
       LIMIT 10`
    ).all()

    // Cases needing review (AI drafts with low confidence items)
    const needsReview = db.prepare(
      `SELECT c.id, c.case_no, c.status, cl.company_name,
              COUNT(ci.id) as item_count,
              AVG(ci.hs_code_confidence) as avg_confidence
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN case_items ci ON c.id = ci.case_id
       WHERE c.deleted_at IS NULL
         AND c.status IN ('DRAFT', 'NEW')
       GROUP BY c.id
       HAVING item_count > 0
       ORDER BY c.created_at DESC
       LIMIT 10`
    ).all()

    // Stalled cases (no activity for 5+ days)
    const stalled = db.prepare(
      `SELECT c.id, c.case_no, c.status, cl.company_name,
              MAX(al.created_at) as last_activity,
              (julianday('now') - julianday(MAX(al.created_at))) as days_stalled
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN activity_log al ON c.id = al.case_id
       WHERE c.deleted_at IS NULL
         AND c.status NOT IN ('CLOSED', 'CANCELLED')
       GROUP BY c.id
       HAVING days_stalled > 5
       ORDER BY days_stalled DESC
       LIMIT 10`
    ).all()

    // Upcoming deadlines (next 7 days)
    const upcomingDeadlines = db.prepare(
      `SELECT t.id, t.title, t.due_date, t.priority, t.task_type,
              c.case_no, c.id as case_id, cl.company_name
       FROM tasks t
       LEFT JOIN cases c ON t.case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE t.deleted_at IS NULL
         AND t.status = 'PENDING'
         AND t.due_date >= datetime('now')
         AND t.due_date <= datetime('now', '+7 days')
       ORDER BY t.due_date ASC
       LIMIT 20`
    ).all()

    // Recently cleared
    const recentlyCleared = db.prepare(
      `SELECT c.id, c.case_no, c.type, cl.company_name, c.cleared_at
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE c.deleted_at IS NULL
         AND c.status = 'CLOSED'
       ORDER BY c.closed_at DESC
       LIMIT 5`
    ).all()

    return {
      customsQueries,
      needsReview,
      stalled,
      upcomingDeadlines,
      recentlyCleared
    }
  })

  ipcMain.handle('dashboard:getDailyBriefing', () => {
    // Stats
    const activeCases = (db.prepare(
      "SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND status NOT IN ('CLOSED', 'CANCELLED')"
    ).get() as { c: number }).c

    const today = new Date().toISOString().split('T')[0]

    const todayDeadlines = (db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE deleted_at IS NULL AND status = 'PENDING' AND date(due_date) = ?"
    ).get(today) as { c: number }).c

    const missingDocs = (db.prepare(
      "SELECT COUNT(*) as c FROM document_checklist WHERE status = 'MISSING' OR status = 'NOT_MENTIONED'"
    ).get() as { c: number }).c

    const highRiskCases = (db.prepare(
      "SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND ai_risk_score >= 0.7"
    ).get() as { c: number }).c

    // Build recommendations
    const recommendations: string[] = []

    const customsUrgent = db.prepare(
      "SELECT COUNT(*) as c FROM emails WHERE ai_category = 'CUSTOMS_QUERY' AND ai_priority = 'URGENT' AND status IN ('UNREAD', 'READ')"
    ).get() as { c: number }

    if (customsUrgent.c > 0) {
      recommendations.push(`有 ${customsUrgent.c} 封海关查询邮件需紧急回复`)
    }

    if (todayDeadlines > 0) {
      recommendations.push(`今天有 ${todayDeadlines} 个截止日期`)
    }

    if (missingDocs > 0) {
      recommendations.push(`${missingDocs} 份文件缺失，需要尽快收集`)
    }

    if (highRiskCases > 0) {
      recommendations.push(`${highRiskCases} 个高风险案件需要关注`)
    }

    // Next best action — the most urgent single item
    const nextBest = db.prepare(
      `SELECT e.id, e.subject, e.ai_summary, e.received_at, e.linked_case_id,
              c.case_no, cl.company_name
       FROM emails e
       LEFT JOIN cases c ON e.linked_case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE e.ai_category = 'CUSTOMS_QUERY'
         AND e.ai_priority IN ('HIGH', 'URGENT')
         AND e.status IN ('UNREAD', 'READ')
       ORDER BY
         CASE e.ai_priority WHEN 'URGENT' THEN 1 ELSE 2 END,
         e.received_at DESC
       LIMIT 1`
    ).get() as Record<string, unknown> | undefined

    // Fallback: oldest stalled case
    const stalledCase = !nextBest ? db.prepare(
      `SELECT c.id, c.case_no, cl.company_name,
              (julianday('now') - julianday(MAX(al.created_at))) as days_stalled
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN activity_log al ON c.id = al.case_id
       WHERE c.deleted_at IS NULL
         AND c.status NOT IN ('CLOSED', 'CANCELLED')
       GROUP BY c.id
       HAVING days_stalled > 5
       ORDER BY days_stalled DESC
       LIMIT 1`
    ).get() as Record<string, unknown> | undefined : null

    return {
      activeCases,
      todayDeadlines,
      missingDocs,
      highRiskCases,
      recommendations,
      nextBestAction: nextBest ? {
        type: 'customs_query' as const,
        title: (nextBest.subject as string) || '海关查询',
        reason: (nextBest.ai_summary as string) || '需要回复',
        case_no: nextBest.case_no as string,
        company_name: nextBest.company_name as string,
        case_id: nextBest.linked_case_id as string
      } : stalledCase ? {
        type: 'stalled_case' as const,
        title: `案件 ${stalledCase.case_no}`,
        reason: `已停滞 ${Math.round(stalledCase.days_stalled as number)} 天`,
        case_no: stalledCase.case_no as string,
        company_name: stalledCase.company_name as string,
        case_id: stalledCase.id as string
      } : null
    }
  })
}
