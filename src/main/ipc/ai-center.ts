import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerAICenterHandlers(): void {
  const db = getDatabase()

  // ── MISSION CONTROL ──────────────────────────────
  ipcMain.handle('ai:getMissionControl', () => {
    const activeCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED')").get() as {c:number}).c
    const unreadEmails = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE deleted_at IS NULL AND comm_type='EMAIL' AND status='UNREAD'").get() as {c:number}).c
    const criticalTasks = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND priority='CRITICAL' AND status IN ('PENDING','IN_PROGRESS')").get() as {c:number}).c
    const overdueItems = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND status IN ('PENDING','IN_PROGRESS') AND due_date < date('now')").get() as {c:number}).c
    const todayReminders = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND status IN ('PENDING','IN_PROGRESS') AND date(due_date) = date('now')").get() as {c:number}).c
    const pendingSuggestions = (db.prepare("SELECT COUNT(*) as c FROM ai_recommendations WHERE status='PENDING'").get() as {c:number}).c
    const todayShipments = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND estimated_arrival >= date('now') AND estimated_arrival <= date('now','+1 day')").get() as {c:number}).c

    // Today's focus - top priority items
    const focus: string[] = []
    const urgentCases = db.prepare("SELECT case_no FROM cases WHERE deleted_at IS NULL AND priority='URGENT' AND status NOT IN ('CLOSED','CANCELLED') LIMIT 3").all() as any[]
    for (const c of urgentCases) focus.push(`审核案件 ${c.case_no}`)
    const missingDocs = db.prepare("SELECT doc_name_cn FROM document_checklist WHERE status NOT IN ('RECEIVED','VERIFIED') AND is_required=1 LIMIT 2").all() as any[]
    for (const d of missingDocs) focus.push(`补充缺失文件: ${d.doc_name_cn}`)
    const todayInspections = db.prepare("SELECT COUNT(*) as c FROM calendar_events WHERE deleted_at IS NULL AND event_type='INSPECTION' AND date(start_time)=date('now')").get() as {c:number}
    if (todayInspections.c > 0) focus.push(`今天有 ${todayInspections.c} 个查验`)

    return { activeCases, unreadEmails, criticalTasks, overdueItems, todayReminders, pendingSuggestions, todayShipments, todayInspections: todayInspections.c, focus }
  })

  // ── UNIFIED SUGGESTIONS ──────────────────────────
  ipcMain.handle('ai:getSuggestions', () => {
    // Collect pending suggestions from all modules
    const suggestions: Array<{ module:string; title:string; description:string; confidence:number; action:string; case_no?:string; client_name?:string }> = []

    // From reminders
    const remSuggestions = db.prepare("SELECT * FROM reminders WHERE deleted_at IS NULL AND is_ai_suggested=1 AND status='PENDING' LIMIT 5").all() as any[]
    for (const r of remSuggestions) suggestions.push({ module:'提醒引擎', title:r.title, description:r.ai_reason||'', confidence:r.ai_confidence||0.8, action:'创建提醒', case_no:r.case_no, client_name:r.client_name })

    // Missing docs
    const missing = db.prepare("SELECT dc.*, c.case_no FROM document_checklist dc LEFT JOIN cases c ON dc.case_id=c.id WHERE dc.status NOT IN ('RECEIVED','VERIFIED') AND dc.is_required=1 LIMIT 5").all() as any[]
    for (const m of missing) suggestions.push({ module:'文件', title:`缺失: ${m.doc_name_cn}`, description:'必要文件尚未收到', confidence:0.92, action:'补充文件', case_no:m.case_no })

    // Stale cases
    const stale = db.prepare("SELECT c.case_no, cl.company_name, (julianday('now')-julianday(MAX(al.created_at))) as days FROM cases c LEFT JOIN activity_log al ON c.id=al.case_id LEFT JOIN clients cl ON c.client_id=cl.id WHERE c.deleted_at IS NULL AND c.status NOT IN ('CLOSED','CANCELLED') GROUP BY c.id HAVING days>7 LIMIT 3").all() as any[]
    for (const s of stale) suggestions.push({ module:'案件', title:`案件停滞: ${s.case_no}`, description:`已 ${Math.round(s.days)} 天无活动`, confidence:0.85, action:'检查案件', case_no:s.case_no, client_name:s.company_name })

    return { suggestions }
  })

  // ── NATURAL LANGUAGE CHAT ────────────────────────
  ipcMain.handle('ai:chat', (_event, query: string) => {
    const q = query.toLowerCase()
    let response = ''

    if (/延迟|delay|shipment.*delay/i.test(q)) {
      const delayed = db.prepare("SELECT case_no FROM cases WHERE deleted_at IS NULL AND estimated_arrival < date('now') AND status NOT IN ('CLOSED','CANCELLED') LIMIT 5").all() as any[]
      response = delayed.length ? `发现 ${delayed.length} 个可能延迟的货物: ${delayed.map((d:any)=>d.case_no).join('、')}` : '没有检测到延迟的货物。'
    } else if (/跟进|customer.*follow|哪个客户/.test(q)) {
      const inactive = db.prepare("SELECT c.company_name FROM clients c WHERE c.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM communications co WHERE co.linked_client_id=c.id AND co.created_at > datetime('now','-30 days')) LIMIT 5").all() as any[]
      response = inactive.length ? `以下客户需要跟进: ${inactive.map((c:any)=>c.company_name).join('、')}` : '所有活跃客户近期都有沟通记录。'
    } else if (/汇总|summary|简报/.test(q)) {
      const active = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED')").get() as {c:number}).c
      const pending = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND status IN ('PENDING','IN_PROGRESS')").get() as {c:number}).c
      response = `今日运维摘要: ${active} 个活跃案件, ${pending} 个待处理提醒。`
    } else if (/发票|invoice/.test(q)) {
      const invDocs = db.prepare("SELECT filename FROM documents WHERE deleted_at IS NULL AND doc_type='INVOICE' LIMIT 5").all() as any[]
      response = invDocs.length ? `找到 ${invDocs.length} 份发票: ${invDocs.map((d:any)=>d.filename).join('、')}` : '未找到发票文件。'
    } else if (/案件.*\d{4}/.test(q)) {
      const caseNo = q.match(/[A-Z]{2}-\d{4}-\d{4}/)?.[0]
      if (caseNo) {
        const c = db.prepare("SELECT * FROM cases WHERE case_no = ?").get(caseNo) as any
        response = c ? `案件 ${c.case_no}: 状态 ${c.status}, 客户 ${c.client_id}, 金额 USD ${c.declared_value||'N/A'}` : `未找到案件 ${caseNo}。`
      } else response = '请提供完整的案件编号。'
    } else {
      response = `我是 Harbor AI 助手。我可以帮你:\n• 查询延迟货物\n• 识别需要跟进的客户\n• 生成运维摘要\n• 查找发票和文件\n• 查询特定案件\n• 分析风险和异常\n\n请描述你需要什么帮助。`
    }

    return { response, query }
  })

  // ── SUBMIT RECOMMENDATION ────────────────────────
  ipcMain.handle('ai:submitRecommendation', (_event, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO ai_recommendations (id, rec_type, source_module, priority, confidence, reason, suggested_action, related_case_id, related_client_id, related_document_id, related_comm_id, context_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.rec_type, data.source_module, data.priority||'MEDIUM', data.confidence, data.reason, data.suggested_action,
      data.related_case_id||null, data.related_client_id||null, data.related_document_id||null, data.related_comm_id||null,
      data.context_json||null)
    return { id }
  })

  ipcMain.handle('ai:reviewRecommendation', (_event, recId: string, userId: string, status: string) => {
    db.prepare("UPDATE ai_recommendations SET status=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").run(status, userId, recId)
    return { success:true }
  })
}
