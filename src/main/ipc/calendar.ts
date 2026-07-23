import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerCalendarHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('calendar:list', (_event, filters: Record<string, string> = {}) => {
    const { start, end, event_type, case_id, owner_id, limit = '100' } = filters
    let where = 'WHERE e.deleted_at IS NULL'
    const params: unknown[] = []

    if (start) { where += ' AND e.start_time >= ?'; params.push(start) }
    if (end) { where += ' AND e.start_time <= ?'; params.push(end) }
    if (event_type) { where += ' AND e.event_type = ?'; params.push(event_type) }
    if (case_id) { where += ' AND e.case_id = ?'; params.push(case_id) }
    if (owner_id) { where += ' AND e.owner_id = ?'; params.push(owner_id) }

    const items = db.prepare(
      `SELECT e.*, c.case_no, cl.company_name as client_name, u.name as owner_name
       FROM calendar_events e
       LEFT JOIN cases c ON e.case_id = c.id
       LEFT JOIN clients cl ON e.client_id = cl.id
       LEFT JOIN users u ON e.owner_id = u.id
       ${where} ORDER BY e.start_time ASC LIMIT ?`
    ).all(...params, parseInt(limit))

    return {
      items: (items as unknown[]).map(r => ({ ...(r as Record<string, unknown>), tags: tryParse((r as any).tags) })),
      total: (items as any[]).length
    }
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('calendar:create', (_event, userId: string, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO calendar_events (id, title, description, event_type, start_time, end_time, all_day,
        priority, status, owner_id, case_id, client_id, location, color, tags, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.title, data.description||null, data.event_type||'MANUAL', data.start_time, data.end_time||null,
      data.all_day?1:0, data.priority||'NORMAL', data.owner_id||userId, data.case_id||null, data.client_id||null,
      data.location||null, data.color||null, data.tags?JSON.stringify(data.tags):null, userId)
    return { id }
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('calendar:update', (_event, eventId: string, data: Record<string, unknown>) => {
    const fields: string[] = []; const values: unknown[] = []
    const map: Record<string, string> = { title:'title', description:'description', event_type:'event_type',
      start_time:'start_time', end_time:'end_time', priority:'priority', status:'status',
      owner_id:'owner_id', case_id:'case_id', client_id:'client_id', location:'location', color:'color' }
    for (const [k,c] of Object.entries(map)) { if (k in data) { fields.push(`${c}=?`); values.push(data[k]) } }
    if ('all_day' in data) { fields.push('all_day=?'); values.push(data.all_day?1:0) }
    if ('tags' in data) { fields.push('tags=?'); values.push(data.tags?JSON.stringify(data.tags):null) }
    if (fields.length===0) return { success:false }
    fields.push("updated_at=datetime('now')"); values.push(eventId)
    db.prepare(`UPDATE calendar_events SET ${fields.join(',')} WHERE id=?`).run(...values)
    return { success:true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('calendar:delete', (_event, eventId: string) => {
    db.prepare("UPDATE calendar_events SET deleted_at = datetime('now') WHERE id = ?").run(eventId)
    return { success: true }
  })

  // ── AUTO-SUGGEST ──────────────────────────────────
  ipcMain.handle('calendar:getSuggestions', () => {
    const suggestions: Array<{ title: string; event_type: string; start_time: string; case_id?: string; client_id?: string; reason: string; confidence: number }> = []

    // Case deadlines
    const caseDeadlines = db.prepare(
      "SELECT id, case_no, deadline_date, client_id FROM cases WHERE deleted_at IS NULL AND deadline_date IS NOT NULL AND deadline_date >= date('now') ORDER BY deadline_date LIMIT 10"
    ).all() as any[]
    for (const c of caseDeadlines) {
      suggestions.push({ title: `案件截止: ${c.case_no}`, event_type: 'CASE_DEADLINE', start_time: c.deadline_date, case_id: c.id, client_id: c.client_id, reason: '案件截止日期', confidence: 0.98 })
    }

    // Task due dates
    const tasks = db.prepare(
      "SELECT id, title, due_date, case_id FROM tasks WHERE deleted_at IS NULL AND status='PENDING' AND due_date >= date('now') ORDER BY due_date LIMIT 10"
    ).all() as any[]
    for (const t of tasks) {
      suggestions.push({ title: `任务截止: ${t.title}`, event_type: 'TASK_DEADLINE', start_time: t.due_date, case_id: t.case_id, reason: '任务截止日期', confidence: 0.95 })
    }

    // Shipment ETAs
    const etas = db.prepare(
      "SELECT id, case_no, estimated_arrival, client_id FROM cases WHERE deleted_at IS NULL AND estimated_arrival IS NOT NULL AND estimated_arrival >= date('now') ORDER BY estimated_arrival LIMIT 10"
    ).all() as any[]
    for (const e of etas) {
      suggestions.push({ title: `到港: ${e.case_no}`, event_type: 'SHIPMENT_ETA', start_time: e.estimated_arrival, case_id: e.id, client_id: e.client_id, reason: '预计到港日期', confidence: 0.9 })
    }

    return { suggestions }
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
