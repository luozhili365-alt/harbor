import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerClientHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('clients:list', (_event, filters: Record<string, string> = {}) => {
    const { q, status, industry, risk_level, account_manager, limit = '50' } = filters
    let where = 'WHERE deleted_at IS NULL'
    const params: unknown[] = []

    if (q) {
      where += ' AND (company_name LIKE ? OR company_name_en LIKE ? OR contact_person LIKE ? OR customs_code LIKE ?)'
      const like = `%${q}%`
      params.push(like, like, like, like)
    }
    if (status) { where += ' AND status = ?'; params.push(status) }
    if (industry) { where += ' AND industry = ?'; params.push(industry) }
    if (risk_level) { where += ' AND risk_level = ?'; params.push(risk_level) }
    if (account_manager) { where += ' AND account_manager = ?'; params.push(account_manager) }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM clients ${where}`).get(...params) as { total: number }
    const items = db.prepare(
      `SELECT c.*, u.name as account_manager_name FROM clients c LEFT JOIN users u ON c.account_manager = u.id ${where} ORDER BY c.company_name ASC LIMIT ?`
    ).all(...params, parseInt(limit))

    const activeCount = (db.prepare("SELECT COUNT(*) as c FROM clients WHERE deleted_at IS NULL AND status = 'ACTIVE'").get() as {c:number}).c
    const prospectCount = (db.prepare("SELECT COUNT(*) as c FROM clients WHERE deleted_at IS NULL AND status = 'PROSPECT'").get() as {c:number}).c
    const highRisk = (db.prepare("SELECT COUNT(*) as c FROM clients WHERE deleted_at IS NULL AND risk_level IN ('HIGH','CRITICAL')").get() as {c:number}).c

    return {
      items: (items as unknown[]).map((c) => ({ ...(c as Record<string, unknown>), tags: tryParse((c as any).tags) })),
      total: countRow.total,
      stats: { active: activeCount, prospect: prospectCount, highRisk }
    }
  })

  // ── GET BY ID ─────────────────────────────────────
  ipcMain.handle('clients:getById', (_event, clientId: string) => {
    const client = db.prepare(
      `SELECT c.*, u.name as account_manager_name FROM clients c LEFT JOIN users u ON c.account_manager = u.id WHERE c.id = ? AND c.deleted_at IS NULL`
    ).get(clientId) as Record<string, unknown> | undefined
    if (!client) return null

    const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name ASC').all(clientId)
    const cases = db.prepare(
      `SELECT id, case_no, status, priority, type, deadline_date, bill_of_lading, updated_at FROM cases WHERE client_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20`
    ).all(clientId)
    const comms = db.prepare(
      `SELECT id, comm_type, subject, from_name, status, created_at FROM communications WHERE linked_client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`
    ).all(clientId)
    const docs = db.prepare(
      `SELECT id, filename, doc_type, ocr_status, is_verified, created_at FROM documents WHERE id IN (SELECT linked_document_id FROM document_checklist WHERE case_id IN (SELECT id FROM cases WHERE client_id = ? AND deleted_at IS NULL)) LIMIT 20`
    ).all(clientId)
    const activeCaseCount = (db.prepare(
      "SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED')"
    ).get(clientId) as {c:number}).c

    return {
      ...client,
      tags: tryParse(client.tags as string),
      health_factors: tryParse(client.health_factors as string),
      contacts,
      cases,
      communications: comms,
      documents: docs,
      activeCaseCount
    }
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('clients:create', (_event, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO clients (id, company_name, company_name_en, legal_name, country, website, industry,
        tax_number, registration_number, preferred_language, status, risk_level,
        account_manager, contact_person, contact_phone, contact_email, customs_code,
        customs_grade, address, notes, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.companyName, data.companyNameEn || null, data.legalName || null, data.country || null,
      data.website || null, data.industry || null, data.taxNumber || null, data.registrationNumber || null,
      data.preferredLanguage || 'zh-CN', data.status || 'ACTIVE', data.riskLevel || 'LOW',
      data.accountManager || null, data.contactPerson || null, data.contactPhone || null,
      data.contactEmail || null, data.customsCode || null, data.customsGrade || null,
      data.address || null, data.notes || null, data.tags ? JSON.stringify(data.tags) : null)
    return { id }
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('clients:update', (_event, clientId: string, data: Record<string, unknown>) => {
    const fields: string[] = []; const values: unknown[] = []
    const map: Record<string, string> = {
      companyName: 'company_name', companyNameEn: 'company_name_en', legalName: 'legal_name',
      country: 'country', website: 'website', industry: 'industry',
      taxNumber: 'tax_number', registrationNumber: 'registration_number',
      preferredLanguage: 'preferred_language', status: 'status', riskLevel: 'risk_level',
      accountManager: 'account_manager', contactPerson: 'contact_person',
      contactPhone: 'contact_phone', contactEmail: 'contact_email',
      customsCode: 'customs_code', customsGrade: 'customs_grade', address: 'address',
      notes: 'notes', internalNotes: 'internal_notes'
    }
    for (const [key, col] of Object.entries(map)) {
      if (key in data) { fields.push(`${col} = ?`); values.push(data[key]) }
    }
    if ('tags' in data) { fields.push('tags = ?'); values.push(data.tags ? JSON.stringify(data.tags) : null) }
    if (fields.length === 0) return { success: false }
    fields.push("updated_at = datetime('now')")
    values.push(clientId)
    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('clients:delete', (_event, clientId: string) => {
    db.prepare("UPDATE clients SET deleted_at = datetime('now') WHERE id = ?").run(clientId)
    return { success: true }
  })

  // ── ARCHIVE / RESTORE ─────────────────────────────
  ipcMain.handle('clients:archive', (_event, clientId: string) => {
    db.prepare("UPDATE clients SET status = 'ARCHIVED', updated_at = datetime('now') WHERE id = ?").run(clientId)
    return { success: true }
  })
  ipcMain.handle('clients:restore', (_event, clientId: string) => {
    db.prepare("UPDATE clients SET status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?").run(clientId)
    return { success: true }
  })

  // ── CONTACTS ──────────────────────────────────────
  ipcMain.handle('clients:addContact', (_event, clientId: string, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO client_contacts (id, client_id, name, position, department, email, phone, mobile, preferred_comm, is_primary, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, clientId, data.name, data.position||null, data.department||null, data.email||null,
      data.phone||null, data.mobile||null, data.preferredComm||null, data.isPrimary ? 1 : 0, data.notes||null)
    return { id }
  })
  ipcMain.handle('clients:updateContact', (_event, contactId: string, data: Record<string, unknown>) => {
    const fields: string[] = []; const values: unknown[] = []
    const map: Record<string, string> = { name:'name', position:'position', department:'department', email:'email', phone:'phone', mobile:'mobile', preferredComm:'preferred_comm', notes:'notes' }
    for (const [k,c] of Object.entries(map)) { if (k in data) { fields.push(`${c} = ?`); values.push(data[k]) } }
    if ('isPrimary' in data) { fields.push('is_primary = ?'); values.push(data.isPrimary ? 1 : 0) }
    if (fields.length === 0) return { success: false }
    fields.push("updated_at = datetime('now')")
    values.push(contactId)
    db.prepare(`UPDATE client_contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })
  ipcMain.handle('clients:deleteContact', (_event, contactId: string) => {
    db.prepare('DELETE FROM client_contacts WHERE id = ?').run(contactId)
    return { success: true }
  })

  // ── HEALTH SCORE ──────────────────────────────────
  ipcMain.handle('clients:getHealthScore', (_event, clientId: string) => {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as Record<string, unknown> | undefined
    if (!client) return null

    const activeCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED')").get(clientId) as {c:number}).c
    const totalCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL").get(clientId) as {c:number}).c
    const staleCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED') AND updated_at < datetime('now','-30 days')").get(clientId) as {c:number}).c
    const docItems = db.prepare("SELECT COUNT(*) as c FROM document_checklist WHERE case_id IN (SELECT id FROM cases WHERE client_id = ?)").get(clientId) as {c:number}
    const docReceived = db.prepare("SELECT COUNT(*) as c FROM document_checklist WHERE case_id IN (SELECT id FROM cases WHERE client_id = ?) AND status IN ('RECEIVED','VERIFIED')").get(clientId) as {c:number}
    const commCount = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE linked_client_id = ? AND deleted_at IS NULL AND created_at > datetime('now','-90 days')").get(clientId) as {c:number}).c

    // Scoring
    let score = 85
    const factors: string[] = []
    if (activeCases <= 3) { score += 5; factors.push('活跃案件数量合理') } else if (activeCases > 10) { score -= 5; factors.push('活跃案件过多') }
    if (staleCases === 0) { score += 3; factors.push('无停滞案件') } else { score -= staleCases * 3; factors.push(`${staleCases} 个案件停滞`) }
    if (docItems > 0 && docReceived / docItems >= 0.9) { score += 3; factors.push('文件齐全') } else if (docItems > 0) { score -= 5; factors.push('文件缺失') }
    if (commCount >= 5) { score += 2; factors.push('沟通活跃') } else { score -= 3; factors.push('近期沟通较少') }
    if (totalCases > 0) { score += 2; factors.push('有合作历史') }
    if (client.risk_level === 'LOW') { score += 3 }
    if (client.risk_level === 'CRITICAL') { score -= 10; factors.push('风险等级为严重') }

    score = Math.max(0, Math.min(100, score))

    db.prepare("UPDATE clients SET health_score = ?, health_factors = ?, updated_at = datetime('now') WHERE id = ?").run(score, JSON.stringify(factors), clientId)

    return { score, factors, maxScore: 100 }
  })

  // ── GET SUMMARY ───────────────────────────────────
  ipcMain.handle('clients:getSummary', (_event, clientId: string) => {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as Record<string, unknown> | undefined
    if (!client) return null

    const activeCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('CLOSED','CANCELLED')").get(clientId) as {c:number}).c
    const completedCases = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE client_id = ? AND deleted_at IS NULL AND status IN ('CLOSED')").get(clientId) as {c:number}).c
    const commCount = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE linked_client_id = ? AND deleted_at IS NULL").get(clientId) as {c:number}).c
    const contactCount = (db.prepare("SELECT COUNT(*) as c FROM client_contacts WHERE client_id = ?").get(clientId) as {c:number}).c
    const openRisks = db.prepare(
      "SELECT DISTINCT c.id, c.case_no, c.status FROM cases c WHERE c.client_id = ? AND c.deleted_at IS NULL AND c.ai_risk_score >= 0.5 LIMIT 5"
    ).all(clientId) as {id:string;case_no:string;status:string}[]

    return {
      companyName: client.company_name,
      status: client.status,
      industry: client.industry,
      country: client.country,
      customsGrade: client.customs_grade,
      activeCases,
      completedCases,
      commCount,
      contactCount,
      healthScore: client.health_score,
      openRisks,
      accountManager: null // Will be joined in getById
    }
  })

  // ── EXPORT ────────────────────────────────────────
  ipcMain.handle('clients:export', (_event, clientId: string) => {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId)
    if (!client) return null
    const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ?').all(clientId)
    const cases = db.prepare('SELECT id, case_no, status, type, priority FROM cases WHERE client_id = ? AND deleted_at IS NULL').all(clientId)
    return { client, contacts, cases, exportedAt: new Date().toISOString() }
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
