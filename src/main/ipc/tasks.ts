import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerTaskHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('tasks:list', (_event, userId: string, filters: Record<string, string> = {}) => {
    const { status = 'PENDING', limit = '20' } = filters

    let where = 'WHERE t.deleted_at IS NULL AND t.assigned_to = ?'
    const params: unknown[] = [userId]

    if (status !== 'ALL') {
      where += ' AND t.status = ?'
      params.push(status)
    }

    const items = db.prepare(
      `SELECT t.*, c.case_no, cl.company_name as client_name
       FROM tasks t
       LEFT JOIN cases c ON t.case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       ${where}
       ORDER BY
         CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
         t.due_date ASC
       LIMIT ?`
    ).all(...params, parseInt(limit))

    const total = (db.prepare(
      `SELECT COUNT(*) as c FROM tasks t WHERE t.deleted_at IS NULL AND t.assigned_to = ? AND t.status = ?`
    ).get(userId, status === 'ALL' ? 'PENDING' : status) as { c: number }).c

    return { items: (items as unknown[]).map((row) => serializeTask(row as Record<string, unknown>)), total }
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('tasks:create', (_event, userId: string, data: {
    title: string
    notes?: string
    priority?: string
    due_date?: string
    reminder?: string
    case_id?: string
    task_type?: string
  }) => {
    const id = uuid()
    const now = new Date().toISOString()
    const dueDate = data.due_date || now.split('T')[0]

    db.prepare(
      `INSERT INTO tasks (id, assigned_to, created_by, task_type, title, description,
        priority, status, due_date, reminder_before, case_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    ).run(
      id,
      userId,
      userId,
      data.task_type || 'MANUAL',
      data.title,
      data.notes || null,
      data.priority || 'NORMAL',
      dueDate,
      data.reminder || null,
      data.case_id || null
    )

    const task = db.prepare(
      `SELECT t.*, c.case_no, cl.company_name as client_name
       FROM tasks t
       LEFT JOIN cases c ON t.case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE t.id = ?`
    ).get(id)

    return serializeTask(task as Record<string, unknown>)
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('tasks:update', (_event, taskId: string, data: Record<string, unknown>) => {
    const fields: string[] = []
    const values: unknown[] = []

    const map: Record<string, string> = {
      title: 'title',
      notes: 'description',
      priority: 'priority',
      due_date: 'due_date',
      reminder: 'reminder_before',
      case_id: 'case_id',
      task_type: 'task_type'
    }

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        values.push(data[key])
      }
    }

    if (fields.length === 0) return { success: false, error: 'No fields to update' }

    values.push(taskId)
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  // ── COMPLETE ──────────────────────────────────────
  ipcMain.handle('tasks:complete', (_event, taskId: string, userId: string) => {
    db.prepare(
      `UPDATE tasks SET status = 'DONE', completed_at = datetime('now'), completed_by = ? WHERE id = ?`
    ).run(userId, taskId)
    return { success: true }
  })

  // ── UNCOMPLETE ────────────────────────────────────
  ipcMain.handle('tasks:uncomplete', (_event, taskId: string) => {
    db.prepare(
      `UPDATE tasks SET status = 'PENDING', completed_at = NULL, completed_by = NULL WHERE id = ?`
    ).run(taskId)
    return { success: true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('tasks:delete', (_event, taskId: string) => {
    db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(taskId)
    return { success: true }
  })
}

function serializeTask(row: Record<string, unknown>) {
  return { ...row }
}
