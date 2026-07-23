import { ipcMain, safeStorage } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'
import { ImapConnector } from './imap-connector'
import { MailboxConfig, EmailMessage } from './types'

/* ── Helpers ─────────────────────────────────── */

function encryptPassword(password: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(password).toString('base64')
  }
  // Fallback: simple base64 (not secure, but functional when safeStorage unavailable)
  return Buffer.from(password).toString('base64')
}

function decryptPassword(encrypted: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
  } catch {}
  // Fallback
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

function saveEmailToCommunications(db: ReturnType<typeof getDatabase>, msg: EmailMessage, mailboxId: string): boolean {
  // Dedup by message_id
  const existing = db.prepare('SELECT id FROM communications WHERE from_contact = ? AND subject = ? AND comm_type = ?').get(msg.messageId, msg.subject, 'EMAIL') as { id: string } | undefined
  if (existing) return false

  const id = uuid()
  db.prepare(
    `INSERT INTO communications (id, comm_type, direction, status, priority,
      from_name, from_contact, subject, body_text, body_html, snippet,
      has_attachments, attachment_ids, received_at, created_at)
     VALUES (?, 'EMAIL', 'INBOUND', 'UNREAD', 'NORMAL',
      ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    msg.fromName,
    msg.fromAddr,
    msg.subject,
    msg.bodyText,
    msg.bodyHtml,
    msg.snippet,
    msg.hasAttachments ? 1 : 0,
    msg.attachmentNames.length > 0 ? JSON.stringify(msg.attachmentNames) : null,
    msg.receivedAt
  )

  return true
}

/* ── Register Handlers ───────────────────────── */

export function registerMailboxHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────
  ipcMain.handle('mailboxes:list', () => {
    const items = db.prepare(
      'SELECT id, name, provider, host, port, username, folders, sync_frequency, last_synced_at, sync_status, error_message, created_at FROM mailboxes ORDER BY created_at'
    ).all()
    return (items as unknown[]).map((r: unknown) => ({ ...(r as Record<string, unknown>), folders: tryParse((r as Record<string, unknown>).folders as string) }))
  })

  // ── ADD ───────────────────────────────────────
  ipcMain.handle('mailboxes:add', (_event, data: {
    name: string; provider: string; host: string; port: number
    tls: boolean; username: string; password: string; folders: string[]
    syncFrequency: number
  }) => {
    const id = uuid()
    const encrypted = encryptPassword(data.password)

    db.prepare(
      `INSERT INTO mailboxes (id, name, provider, host, port, tls, username, password_encrypted, folders, sync_frequency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.provider, data.host, data.port, data.tls ? 1 : 0, data.username, encrypted, JSON.stringify(data.folders || ['INBOX']), data.syncFrequency || 15)

    return { id }
  })

  // ── UPDATE ────────────────────────────────────
  ipcMain.handle('mailboxes:update', (_event, id: string, data: Record<string, unknown>) => {
    const fields: string[] = []
    const values: unknown[] = []
    const map: Record<string, string> = { name: 'name', provider: 'provider', host: 'host', port: 'port', syncFrequency: 'sync_frequency' }

    for (const [k, col] of Object.entries(map)) {
      if (k in data) { fields.push(`${col} = ?`); values.push(data[k]) }
    }
    if ('tls' in data) { fields.push('tls = ?'); values.push(data.tls ? 1 : 0) }
    if ('username' in data) { fields.push('username = ?'); values.push(data.username) }
    if ('password' in data) {
      fields.push('password_encrypted = ?')
      values.push(encryptPassword(data.password as string))
    }
    if ('folders' in data) { fields.push('folders = ?'); values.push(JSON.stringify(data.folders)) }

    if (fields.length === 0) return { success: false }
    fields.push("updated_at = datetime('now')")
    values.push(id)
    db.prepare(`UPDATE mailboxes SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  // ── DELETE ────────────────────────────────────
  ipcMain.handle('mailboxes:delete', (_event, id: string) => {
    db.prepare('DELETE FROM mailboxes WHERE id = ?').run(id)
    return { success: true }
  })

  // ── TEST CONNECTION ───────────────────────────
  ipcMain.handle('mailboxes:test', async (_event, data: {
    host: string; port: number; tls: boolean; username: string; password: string
  }) => {
    const connector = new ImapConnector({
      id: 'test', name: 'Test', provider: 'IMAP',
      host: data.host,
      port: data.port || 993,
      tls: data.tls !== false,
      username: data.username,
      password: data.password,
      folders: ['INBOX'],
      syncFrequency: 15,
    })

    try {
      const result = await connector.testConnection()
      return result
    } finally {
      await connector.disconnect()
    }
  })

  // ── SYNC ──────────────────────────────────────
  ipcMain.handle('mailboxes:sync', async (_event, mailboxId: string) => {
    const row = db.prepare('SELECT * FROM mailboxes WHERE id = ?').get(mailboxId) as Record<string, unknown> | undefined
    if (!row) return { success: false, error: '邮箱不存在' }

    // Update status to SYNCING
    db.prepare("UPDATE mailboxes SET sync_status = 'SYNCING', error_message = NULL, updated_at = datetime('now') WHERE id = ?").run(mailboxId)

    const config: MailboxConfig = {
      id: row.id as string,
      name: row.name as string,
      provider: row.provider as string,
      host: row.host as string,
      port: row.port as number,
      tls: !!row.tls,
      username: row.username as string,
      password: decryptPassword(row.password_encrypted as string),
      folders: (tryParse(row.folders as string) as string[]) || ['INBOX'],
      syncFrequency: (row.sync_frequency as number) || 15,
    }

    const connector = new ImapConnector(config)
    const sinceDate = row.last_synced_at as string || undefined

    try {
      const messages = await connector.sync(sinceDate)
      let newCount = 0

      for (const msg of messages) {
        const saved = saveEmailToCommunications(db, msg, mailboxId)
        if (saved) newCount++
      }

      const now = new Date().toISOString()
      db.prepare(
        "UPDATE mailboxes SET sync_status = 'CONNECTED', last_synced_at = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(now, mailboxId)

      return {
        success: true,
        total: messages.length,
        new: newCount,
        skipped: messages.length - newCount,
        lastSync: now,
      }
    } catch (err: any) {
      db.prepare(
        "UPDATE mailboxes SET sync_status = 'ERROR', error_message = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(err.message || '同步失败', mailboxId)

      return { success: false, error: err.message, total: 0, new: 0 }
    } finally {
      await connector.disconnect()
    }
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
