import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerReminderHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('reminders:list', (_event, filters: Record<string, string> = {}) => {
    const { status, priority, owner_id, case_id, q, limit = '50' } = filters
    let where = 'WHERE r.deleted_at IS NULL'
    const params: unknown[] = []

    if (status === 'ACTIVE') { where += " AND r.status IN ('PENDING','IN_PROGRESS')" }
    else if (status) { where += ' AND r.status = ?'; params.push(status) }
    if (priority) { where += ' AND r.priority = ?'; params.push(priority) }
    if (owner_id) { where += ' AND r.owner_id = ?'; params.push(owner_id) }
    if (case_id) { where += ' AND r.case_id = ?'; params.push(case_id) }
    if (q) { where += ' AND r.title LIKE ?'; params.push(`%${q}%`) }

    const items = db.prepare(
      `SELECT r.*, c.case_no, cl.company_name as client_name, u.name as owner_name
       FROM reminders r LEFT JOIN cases c ON r.case_id = c.id
       LEFT JOIN clients cl ON r.client_id = cl.id LEFT JOIN users u ON r.owner_id = u.id
       ${where} ORDER BY CASE r.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, r.due_date ASC LIMIT ?`
    ).all(...params, parseInt(limit))

    const critical = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND priority='CRITICAL' AND status IN ('PENDING','IN_PROGRESS')").get() as {c:number}).c
    const high = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND priority='HIGH' AND status IN ('PENDING','IN_PROGRESS')").get() as {c:number}).c
    const overdue = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND status IN ('PENDING','IN_PROGRESS') AND due_date < date('now')").get() as {c:number}).c
    const aiSuggestions = (db.prepare("SELECT COUNT(*) as c FROM reminders WHERE deleted_at IS NULL AND is_ai_suggested = 1 AND status = 'PENDING'").get() as {c:number}).c

    return {
      items: (items as unknown[]).map(r => ({ ...(r as Record<string, unknown>), tags: tryParse((r as any).tags) })),
      total: (items as any[]).length,
      stats: { critical, high, overdue, aiSuggestions }
    }
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('reminders:create', (_event, userId: string, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO reminders (id, title, description, reminder_type, priority, status, due_date, due_time,
        owner_id, case_id, client_id, document_id, source_module, is_ai_suggested, ai_confidence, ai_reason,
        recurrence_rule, tags, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.title, data.description||null, data.reminder_type||'MANUAL', data.priority||'MEDIUM',
      data.due_date, data.due_time||null, data.owner_id||userId, data.case_id||null, data.client_id||null,
      data.document_id||null, data.source_module||'MANUAL', data.is_ai_suggested?1:0, data.ai_confidence||null,
      data.ai_reason||null, data.recurrence_rule||null, data.tags?JSON.stringify(data.tags):null, data.notes||null, userId)
    return { id }
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('reminders:update', (_event, eventId: string, data: Record<string, unknown>) => {
    const fields: string[] = []; const values: unknown[] = []
    const map: Record<string, string> = { title:'title', description:'description', reminder_type:'reminder_type',
      priority:'priority', status:'status', due_date:'due_date', due_time:'due_time', owner_id:'owner_id',
      case_id:'case_id', client_id:'client_id', document_id:'document_id', notes:'notes', recurrence_rule:'recurrence_rule' }
    for (const [k,c] of Object.entries(map)) { if (k in data) { fields.push(`${c}=?`); values.push(data[k]) } }
    if ('tags' in data) { fields.push('tags=?'); values.push(data.tags?JSON.stringify(data.tags):null) }
    if (fields.length===0) return { success:false }
    fields.push("updated_at=datetime('now')"); values.push(eventId)
    db.prepare(`UPDATE reminders SET ${fields.join(',')} WHERE id=?`).run(...values)
    return { success:true }
  })

  // ── COMPLETE ──────────────────────────────────────
  ipcMain.handle('reminders:complete', (_event, reminderId: string, userId: string) => {
    db.prepare("UPDATE reminders SET status='COMPLETED', completed_at=datetime('now'), completed_by=?, updated_at=datetime('now') WHERE id=?").run(userId, reminderId)
    return { success:true }
  })

  // ── CANCEL ────────────────────────────────────────
  ipcMain.handle('reminders:cancel', (_event, reminderId: string) => {
    db.prepare("UPDATE reminders SET status='CANCELLED', updated_at=datetime('now') WHERE id=?").run(reminderId)
    return { success:true }
  })

  // ── SNOOZE ────────────────────────────────────────
  ipcMain.handle('reminders:snooze', (_event, reminderId: string, until: string) => {
    db.prepare("UPDATE reminders SET snooze_until=?, status='SNOOZED', updated_at=datetime('now') WHERE id=?").run(until, reminderId)
    return { success:true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('reminders:delete', (_event, reminderId: string) => {
    db.prepare("UPDATE reminders SET deleted_at = datetime('now') WHERE id = ?").run(reminderId)
    return { success:true }
  })

  // ── AI SUGGESTIONS ───────────────────────────────
  ipcMain.handle('reminders:getSuggestions', () => {
    const suggestions: Array<{ title:string; reminder_type:string; priority:string; due_date:string; case_id?:string; client_id?:string; reason:string; confidence:number }> = []

    // Overdue tasks
    const overdueTasks = db.prepare("SELECT id, title, due_date, case_id FROM tasks WHERE deleted_at IS NULL AND status='PENDING' AND due_date < datetime('now') LIMIT 5").all() as any[]
    for (const t of overdueTasks) suggestions.push({ title:`过期任务: ${t.title}`, reminder_type:'TASK_DEADLINE', priority:'HIGH', due_date: new Date().toISOString().split('T')[0], case_id:t.case_id, reason:'任务已过期', confidence:0.98 })

    // Case deadlines within 3 days
    const soonCases = db.prepare("SELECT id, case_no, deadline_date, client_id FROM cases WHERE deleted_at IS NULL AND deadline_date BETWEEN date('now') AND date('now','+3 days') LIMIT 5").all() as any[]
    for (const c of soonCases) suggestions.push({ title:`案件截止: ${c.case_no}`, reminder_type:'CASE_DEADLINE', priority:'CRITICAL', due_date:c.deadline_date, case_id:c.id, client_id:c.client_id, reason:'案件截止在即', confidence:0.96 })

    // Missing docs
    const missingDocs = db.prepare("SELECT dc.doc_name_cn, dc.case_id, c.client_id FROM document_checklist dc LEFT JOIN cases c ON dc.case_id=c.id WHERE dc.status NOT IN ('RECEIVED','VERIFIED') AND dc.is_required=1 LIMIT 5").all() as any[]
    for (const d of missingDocs) suggestions.push({ title:`缺失文件: ${d.doc_name_cn}`, reminder_type:'DOCUMENT_DEADLINE', priority:'HIGH', due_date: new Date(Date.now()+86400000).toISOString().split('T')[0], case_id:d.case_id, client_id:d.client_id, reason:'必要文件缺失', confidence:0.92 })

    // Inactive customers (no comms in 30 days)
    const inactive = db.prepare("SELECT c.id, c.company_name FROM clients c WHERE c.status='ACTIVE' AND c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM communications co WHERE co.linked_client_id=c.id AND co.created_at > datetime('now','-30 days')) LIMIT 3").all() as any[]
    for (const c of inactive) suggestions.push({ title:`跟进客户: ${c.company_name}`, reminder_type:'CUSTOMER_FOLLOWUP', priority:'MEDIUM', due_date: new Date().toISOString().split('T')[0], client_id:c.id, reason:'客户30天无沟通', confidence:0.78 })

    return { suggestions }
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
