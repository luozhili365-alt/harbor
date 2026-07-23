import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256')
    .update(password + salt)
    .digest('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':')
  const hash = createHash('sha256')
    .update(password + salt)
    .digest('hex')
  return timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash))
}

export function registerAuthHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('auth:hasUsers', () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
      console.log('[auth:hasUsers]', row.c, 'users found')
      return row.c > 0
    } catch (err) {
      console.error('[auth:hasUsers] Error:', err)
      return false
    }
  })

  ipcMain.handle('db:getPath', () => {
    return db.name
  })

  ipcMain.handle('db:reset', () => {
    db.exec(`
      DELETE FROM ai_feedback;
      DELETE FROM suggested_updates;
      DELETE FROM reminder_instances;
      DELETE FROM reminder_cascades;
      DELETE FROM workflow_blockers;
      DELETE FROM workflow_stages;
      DELETE FROM document_checklist;
      DELETE FROM email_extractions;
      DELETE FROM emails;
      DELETE FROM activity_log;
      DELETE FROM tasks;
      DELETE FROM documents;
      DELETE FROM case_items;
      DELETE FROM cases;
      DELETE FROM clients;
      DELETE FROM users;
    `)
    console.log('[db:reset] All data cleared')
    return { success: true }
  })

  ipcMain.handle('auth:login', (_event, email: string, password: string) => {
    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .get(email) as Record<string, unknown> | undefined

    if (!user || !verifyPassword(password, user.password_hash as string)) {
      return { success: false, error: '邮箱或密码错误' }
    }

    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id)

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaEnabled: !!user.mfa_enabled,
        isActive: !!user.is_active,
        avatarUrl: user.avatar_url,
        lastLoginAt: user.last_login_at
      }
    }
  })

  ipcMain.handle('auth:getCurrentUser', (_event, userId: string) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(userId) as Record<string, unknown> | undefined
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mfaEnabled: !!user.mfa_enabled,
      isActive: !!user.is_active,
      avatarUrl: user.avatar_url,
      lastLoginAt: user.last_login_at
    }
  })

  ipcMain.handle('auth:changePassword', (_event, userId: string, currentPassword: string, newPassword: string) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined
    if (!user) return { success: false, error: '用户不存在' }
    if (!verifyPassword(currentPassword, user.password_hash as string)) {
      return { success: false, error: '当前密码错误' }
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      hashPassword(newPassword),
      userId
    )
    return { success: true }
  })

  ipcMain.handle('auth:resetUserPassword', (_event, adminUserId: string, targetEmail: string, newPassword: string) => {
    try {
      // Verify admin permissions
      const admin = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(adminUserId) as { role: string } | undefined
      if (!admin || admin.role !== 'admin') {
        return { success: false, error: '仅管理员可以重置密码' }
      }

      const target = db.prepare('SELECT id FROM users WHERE email = ?').get(targetEmail) as { id: string } | undefined
      if (!target) {
        return { success: false, error: '未找到该账号' }
      }

      const hashed = hashPassword(newPassword)
      db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashed, target.id)
      console.log('[auth:resetUserPassword] Admin reset password for:', targetEmail)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[auth:resetUserPassword] ERROR:', msg)
      return { success: false, error: `重置失败: ${msg}` }
    }
  })

  ipcMain.handle('auth:createUser', (_event, data: { name: string; email: string; password: string; role: string }) => {
    try {
      const existing = db.prepare('SELECT email FROM users WHERE email = ?').get(data.email) as { email: string } | undefined
      if (existing) {
        console.log('[auth:createUser] Email already exists:', existing.email)
        return { success: false, error: `该邮箱已存在 (${existing.email})` }
      }

      const id = uuid()
      const hashed = hashPassword(data.password)
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, data.name, data.email, hashed, data.role)

      console.log('[auth:createUser] Created:', data.email, 'id:', id)

      // Return user object directly — no separate login needed
      return {
        success: true,
        id,
        user: {
          id,
          name: data.name,
          email: data.email,
          role: data.role
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[auth:createUser] ERROR:', msg)
      return { success: false, error: `创建失败: ${msg}` }
    }
  })
}
