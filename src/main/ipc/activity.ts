import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerActivityHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('activity:recent', (_event, limit = 20) => {
    const items = db.prepare(
      `SELECT al.*, c.case_no, u.name as user_name
       FROM activity_log al
       LEFT JOIN cases c ON al.case_id = c.id
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT ?`
    ).all(limit)

    return items.map((row: unknown) => {
      const r = row as Record<string, unknown>
      return {
        ...r,
        metadata: tryParse(r.metadata as string)
      }
    })
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
