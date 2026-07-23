import { ipcMain, dialog } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'
import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'

function getDocsDir(): string {
  const userData = require('electron').app.getPath('userData')
  const dir = join(userData, 'documents')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function registerDocumentHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('documents:list', (_event, filters: Record<string, string> = {}) => {
    const { status, doc_type, case_id, client_id, q, limit = '50' } = filters
    let where = 'WHERE d.deleted_at IS NULL'
    const params: unknown[] = []

    if (status) { where += ' AND d.status = ?'; params.push(status) }
    if (doc_type) { where += ' AND d.doc_type = ?'; params.push(doc_type) }
    if (case_id) { where += ' AND d.case_id = ?'; params.push(case_id) }
    if (client_id) {
      where += ' AND d.case_id IN (SELECT id FROM cases WHERE client_id = ?)'
      params.push(client_id)
    }
    if (q) {
      where += ' AND (d.filename LIKE ? OR d.doc_type LIKE ?)'
      const like = `%${q}%`
      params.push(like, like)
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents d ${where}`).get(...params) as { total: number }
    const items = db.prepare(
      `SELECT d.*, c.case_no, cl.company_name as client_name
       FROM documents d
       LEFT JOIN cases c ON d.case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       ${where} ORDER BY d.created_at DESC LIMIT ?`
    ).all(...params, parseInt(limit))

    const pendingReview = (db.prepare("SELECT COUNT(*) as c FROM documents WHERE deleted_at IS NULL AND status IN ('UPLOADED','PROCESSING')").get() as {c:number}).c
    const missing = (db.prepare("SELECT COUNT(*) as c FROM document_checklist WHERE status NOT IN ('RECEIVED','VERIFIED')").get() as {c:number}).c

    return {
      items: (items as unknown[]).map(r => ({ ...(r as Record<string, unknown>), extracted_data: tryParse((r as any).extracted_data) })),
      total: countRow.total,
      stats: { pendingReview, missing, total: countRow.total }
    }
  })

  // ── GET BY ID ─────────────────────────────────────
  ipcMain.handle('documents:getById', (_event, docId: string) => {
    const doc = db.prepare(
      `SELECT d.*, c.case_no, cl.company_name as client_name FROM documents d LEFT JOIN cases c ON d.case_id = c.id LEFT JOIN clients cl ON c.client_id = cl.id WHERE d.id = ? AND d.deleted_at IS NULL`
    ).get(docId) as Record<string, unknown> | undefined
    if (!doc) return null
    return { ...doc, extracted_data: tryParse(doc.extracted_data as string) }
  })

  // ── UPLOAD ────────────────────────────────────────
  ipcMain.handle('documents:upload', async (_event, userId: string, data: { caseId?: string; clientId?: string; filePath?: string }) => {
    // Open file dialog
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents', extensions: ['pdf','png','jpg','jpeg','xlsx','xls','docx','doc','csv','zip','txt'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'No file selected' }

    const docsDir = getDocsDir()
    const inserted: string[] = []

    for (const filePath of result.filePaths) {
      const id = uuid()
      const filename = filePath.split('/').pop() || 'unknown'
      const ext = extname(filename).toLowerCase()
      const storagePath = join(docsDir, `${id}${ext}`)

      // Copy file to storage
      copyFileSync(filePath, storagePath)

      // Classify by filename keywords
      const lower = filename.toLowerCase()
      let docType = 'OTHER'
      if (/发票|invoice/i.test(lower)) docType = 'INVOICE'
      else if (/箱单|packing/i.test(lower)) docType = 'PACKING_LIST'
      else if (/提单|bill.*lading|bl/i.test(lower)) docType = 'BILL_OF_LADING'
      else if (/产地证|coo|cert.*origin/i.test(lower)) docType = 'CERTIFICATE'
      else if (/报关单|declaration/i.test(lower)) docType = 'CUSTOMS_DECLARATION'
      else if (/到货|arrival/i.test(lower)) docType = 'ARRIVAL_NOTICE'
      else if (/合同|contract/i.test(lower)) docType = 'CONTRACT'
      else if (/保单|insurance/i.test(lower)) docType = 'INSURANCE'

      db.prepare(
        `INSERT INTO documents (id, filename, storage_path, doc_type, file_size, case_id, mime_type, status, sha256_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'UPLOADED', ?)`
      ).run(id, filename, storagePath, docType, 0, data.caseId || null, ext, id)

      // Auto-classify confidence
      db.prepare("UPDATE documents SET extracted_data = ? WHERE id = ?").run(
        JSON.stringify({ classification: { type: docType, confidence: 0.75, source: 'filename' } }), id
      )

      // Update checklist if linked to case
      if (data.caseId) {
        const checklistItem = db.prepare(
          "SELECT id FROM document_checklist WHERE case_id = ? AND doc_type = ? LIMIT 1"
        ).get(data.caseId, docType)
        if (checklistItem) {
          db.prepare("UPDATE document_checklist SET status = 'RECEIVED', linked_document_id = ? WHERE id = ?").run(id, (checklistItem as any).id)
        }
      }

      inserted.push(id)
    }

    return { success: true, count: inserted.length, ids: inserted }
  })

  // ── CLASSIFY ──────────────────────────────────────
  ipcMain.handle('documents:classify', (_event, docId: string) => {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Record<string, unknown> | undefined
    if (!doc) return null

    const filename = ((doc.filename as string) || '').toLowerCase()
    const checks: Array<[string, string, RegExp[]]> = [
      ['INVOICE', '商业发票', [/发票|invoice/i]],
      ['PACKING_LIST', '装箱单', [/箱单|packing|P\/L/i]],
      ['BILL_OF_LADING', '提单', [/提单|bill.*lading|B\/L/i]],
      ['CERTIFICATE', '原产地证', [/产地证|coo|cert.*origin|form\s*[AEF]/i]],
      ['CUSTOMS_DECLARATION', '报关单', [/报关单|declaration/i]],
      ['ARRIVAL_NOTICE', '到货通知', [/到货|arrival/i]],
      ['CONTRACT', '合同', [/合同|contract|agreement/i]],
      ['INSURANCE', '保险', [/保险|insurance/i]],
    ]

    let bestType = 'OTHER'; let bestConf = 0; let reason = '无法确定文件类型'
    for (const [t, r, patterns] of checks) {
      const score = patterns.some(p => p.test(filename)) ? 0.82 : patterns.some(p => p.test(filename.replace(/[^a-zA-Z一-龥]/g,''))) ? 0.65 : 0
      if (score > bestConf) { bestType = t; bestConf = score; reason = `文件名包含${r}相关关键词` }
    }
    if (bestConf < 0.6) { bestConf = 0.5; reason = '默认分类' }

    db.prepare("UPDATE documents SET doc_type = ?, extracted_data = ?, updated_at = datetime('now') WHERE id = ?").run(
      bestType, JSON.stringify({ classification: { type: bestType, confidence: bestConf, reason } }), docId
    )

    return { type: bestType, confidence: bestConf, reason }
  })

  // ── VERIFY ────────────────────────────────────────
  ipcMain.handle('documents:verify', (_event, docId: string, userId: string, approved: boolean, comment?: string) => {
    db.prepare("UPDATE documents SET status = ?, is_verified = ?, verified_by = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
      approved ? 'APPROVED' : 'REJECTED', approved ? 1 : 0, userId, docId
    )
    return { success: true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('documents:delete', (_event, docId: string) => {
    db.prepare("UPDATE documents SET deleted_at = datetime('now') WHERE id = ?").run(docId)
    return { success: true }
  })

  // ── MISSING DOCS ──────────────────────────────────
  ipcMain.handle('documents:getMissing', (_event, caseId?: string) => {
    let where = "WHERE dc.status NOT IN ('RECEIVED','VERIFIED')"
    const params: unknown[] = []
    if (caseId) { where += ' AND dc.case_id = ?'; params.push(caseId) }

    const items = db.prepare(
      `SELECT dc.*, c.case_no, cl.company_name as client_name
       FROM document_checklist dc
       LEFT JOIN cases c ON dc.case_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       ${where} ORDER BY dc.tier, dc.doc_type LIMIT 50`
    ).all(...params)

    return {
      items,
      total: items.length
    }
  })
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
