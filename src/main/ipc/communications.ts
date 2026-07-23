import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

export function registerCommunicationHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('communications:list', (_event, filters: Record<string, string> = {}) => {
    const { status, comm_type, priority, linked_case_id, linked_client_id, assigned_to, q, limit = '30', offset = '0' } = filters

    let where = 'WHERE c.deleted_at IS NULL'
    const params: unknown[] = []

    if (status) {
      if (status === 'ACTIVE') { where += " AND c.status IN ('UNREAD','READ','ASSIGNED','WAITING','FLAGGED')" }
      else { where += ' AND c.status = ?'; params.push(status) }
    }
    if (comm_type) { where += ' AND c.comm_type = ?'; params.push(comm_type) }
    if (priority) { where += ' AND c.priority = ?'; params.push(priority) }
    if (linked_case_id) { where += ' AND c.linked_case_id = ?'; params.push(linked_case_id) }
    if (linked_client_id) { where += ' AND c.linked_client_id = ?'; params.push(linked_client_id) }
    if (assigned_to) { where += ' AND c.assigned_to = ?'; params.push(assigned_to) }
    if (q) {
      where += ' AND (c.subject LIKE ? OR c.body_text LIKE ? OR c.from_name LIKE ? OR c.from_contact LIKE ?)'
      const like = `%${q}%`
      params.push(like, like, like, like)
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM communications c ${where}`
    ).get(...params) as { total: number }

    const items = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name, ca.case_no
       FROM communications c
       LEFT JOIN clients cl ON c.linked_client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN cases ca ON c.linked_case_id = ca.id
       ${where}
       ORDER BY
         CASE c.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
         c.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, parseInt(limit), parseInt(offset))

    // Quick stats
    const unread = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE deleted_at IS NULL AND status = 'UNREAD'").get() as { c: number }).c
    const highPriority = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE deleted_at IS NULL AND priority IN ('HIGH','URGENT') AND status IN ('UNREAD','READ','ASSIGNED','WAITING','FLAGGED')").get() as { c: number }).c
    const aiWaiting = (db.prepare("SELECT COUNT(*) as c FROM communications WHERE deleted_at IS NULL AND ai_processed = 0 AND status NOT IN ('ARCHIVED','ACTIONED')").get() as { c: number }).c

    return {
      items: (items as unknown[]).map((row) => serializeComm(row as Record<string, unknown>)),
      total: countRow.total,
      stats: { unread, highPriority, aiWaiting }
    }
  })

  // ── GET BY ID ─────────────────────────────────────
  ipcMain.handle('communications:getById', (_event, commId: string) => {
    const c = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name, ca.case_no
       FROM communications c
       LEFT JOIN clients cl ON c.linked_client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN cases ca ON c.linked_case_id = ca.id
       WHERE c.id = ? AND c.deleted_at IS NULL`
    ).get(commId)

    if (!c) return null

    // Auto-mark as READ when viewed
    const row = c as Record<string, unknown>
    if (row.status === 'UNREAD') {
      db.prepare("UPDATE communications SET status = 'READ', updated_at = datetime('now') WHERE id = ?").run(commId)
    }

    return serializeComm(row)
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('communications:create', (_event, userId: string, data: Record<string, unknown>) => {
    const id = uuid()

    db.prepare(
      `INSERT INTO communications (id, comm_type, direction, status, priority,
        from_name, from_contact, participants, subject, body_text, body_html, snippet,
        linked_case_id, linked_client_id, assigned_to, tags, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.comm_type || 'MANUAL',
      data.direction || 'INBOUND',
      data.status || 'UNREAD',
      data.priority || 'NORMAL',
      data.from_name || null,
      data.from_contact || null,
      data.participants ? JSON.stringify(data.participants) : null,
      data.subject || null,
      data.body_text || null,
      data.body_html || null,
      data.body_text ? (data.body_text as string).slice(0, 200) : null,
      data.linked_case_id || null,
      data.linked_client_id || null,
      data.assigned_to || userId,
      data.tags ? JSON.stringify(data.tags) : null,
      data.notes || null,
      userId
    )

    // Log activity
    logAudit(db, 'COMM_CREATED', userId, `创建沟通记录`, { comm_id: id, comm_type: data.comm_type })

    return { id }
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('communications:update', (_event, commId: string, data: Record<string, unknown>, userId: string) => {
    const fields: string[] = []
    const values: unknown[] = []

    const map: Record<string, string> = {
      status: 'status', priority: 'priority', comm_type: 'comm_type',
      from_name: 'from_name', from_contact: 'from_contact',
      subject: 'subject', body_text: 'body_text', body_html: 'body_html',
      linked_case_id: 'linked_case_id', linked_client_id: 'linked_client_id',
      assigned_to: 'assigned_to', notes: 'notes', direction: 'direction'
    }

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        values.push(data[key])
      }
    }

    if ('participants' in data) {
      fields.push('participants = ?')
      values.push(data.participants ? JSON.stringify(data.participants) : null)
    }
    if ('tags' in data) {
      fields.push('tags = ?')
      values.push(data.tags ? JSON.stringify(data.tags) : null)
    }
    if ('snippet' in data) {
      fields.push('snippet = ?')
      values.push(data.snippet)
    }

    if (fields.length === 0) return { success: false, error: 'No fields to update' }

    fields.push("updated_at = datetime('now')")
    values.push(commId)

    db.prepare(`UPDATE communications SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(db, 'COMM_UPDATED', userId, `更新沟通记录`, { comm_id: commId, changes: Object.keys(data) })
    return { success: true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('communications:delete', (_event, commId: string, userId: string) => {
    // Permission check: only admin or creator can delete
    const comm = db.prepare('SELECT created_by FROM communications WHERE id = ?').get(commId) as { created_by: string } | undefined
    if (!comm) return { success: false, error: '记录不存在' }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined
    if (user?.role !== 'admin' && comm.created_by !== userId) {
      return { success: false, error: '没有删除权限' }
    }

    db.prepare("UPDATE communications SET deleted_at = datetime('now') WHERE id = ?").run(commId)
    logAudit(db, 'COMM_DELETED', userId, `删除沟通记录`, { comm_id: commId })
    return { success: true }
  })

  // ── BULK UPDATE ───────────────────────────────────
  ipcMain.handle('communications:bulkUpdate', (_event, ids: string[], data: Record<string, unknown>, userId: string) => {
    for (const id of ids) {
      const fields: string[] = []
      const values: unknown[] = []
      if (data.status) { fields.push('status = ?'); values.push(data.status) }
      if (data.assigned_to) { fields.push('assigned_to = ?'); values.push(data.assigned_to) }
      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')")
        values.push(id)
        db.prepare(`UPDATE communications SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      }
    }
    logAudit(db, 'COMM_BULK_UPDATE', userId, `批量更新 ${ids.length} 条沟通记录`, { ids, changes: data })
    return { success: true }
  })

  // ── AI ANALYZE (Enhanced: Classification + Entity Extraction + Case Matching) ──
  ipcMain.handle('communications:analyze', (_event, commId: string) => {
    const comm = db.prepare('SELECT * FROM communications WHERE id = ? AND deleted_at IS NULL').get(commId) as Record<string, unknown> | undefined
    if (!comm) return { success: false, error: '记录不存在' }

    const fullText = [comm.subject, comm.body_text, comm.from_name].filter(Boolean).join(' ')
    const text = (fullText || '').toLowerCase()
    const extracted: Record<string, { value: string; confidence: number }> = {}

    /* ── 1. CLASSIFICATION ─────────────────────── */
    const classify = (t: string): { category: string; confidence: number; reasoning: string } => {
      const checks: Array<[string, string, RegExp[]]> = [
        ['BILL_OF_LADING', '提单', [/提单|bill\s*of\s*lading|B\/L|BL\s*No/i]],
        ['INVOICE', '发票', [/发票|invoice|commercial\s*inv/i]],
        ['PACKING_LIST', '装箱单', [/装箱单|packing\s*list|P\/L/i]],
        ['CERTIFICATE', '证书', [/产地证|检验检疫|熏蒸|certificate|COO|FORM\s*[AEF]/i]],
        ['CUSTOMS_NOTICE', '海关通知', [/海关|customs|custom\s*notice|查验|inspection/i]],
        ['SHIPPING_UPDATE', '物流更新', [/船期|到港|离港|ETA|ETD|vessel|voyage|航次/i]],
        ['INSPECTION', '查验', [/查验|检验|inspection|quarantine|检疫/i]],
        ['CUSTOMER_REQUEST', '客户请求', [/请|request|需要|can\s*you|please/i]],
        ['SUPPLIER_COMM', '供应商', [/供应商|supplier|工厂|factory|manufacturer/i]],
        ['PAYMENT', '付款', [/付款|支付|payment|invoice|fee|费用|汇款/i]],
        ['URGENT', '紧急', [/紧急|urgent|尽快|ASAP|immediately|马上/i]],
        ['NEWSLETTER', '新闻', [/newsletter|news|update|周报|月报/i]],
        ['MARKETING', '营销', [/promo|offer|discount|广告|促销/i]],
        ['SPAM', '垃圾邮件', [/spam|unsuscribe|click\s*here|buy\s*now/i]],
        ['INTERNAL', '内部', [/内部|internal|memo|通知|announcement/i]],
      ]
      for (const [cat, reason, patterns] of checks) {
        if (patterns.some(p => p.test(t))) return { category: cat, confidence: 0.85, reasoning: `检测到${reason}相关关键词` }
      }
      return { category: 'BUSINESS', confidence: 0.6, reasoning: '默认为商务沟通' }
    }
    const classification = classify(text)

    /* ── 2. ENTITY EXTRACTION ──────────────────── */
    // B/L Number
    const blMatch = fullText.match(/([A-Z]{3}\d{8,14}|BL[:\s]*[A-Z0-9]+|提单号[:\s]*[A-Z0-9]+)/i)
    if (blMatch) extracted['提单号'] = { value: blMatch[0].replace(/提单号[:\s]*/i, '').toUpperCase(), confidence: 0.85 }

    // Container Number
    const cntMatch = fullText.match(/([A-Z]{4}\d{7}|[A-Z]{3}U\d{6,8})/g)
    if (cntMatch) extracted['集装箱号'] = { value: cntMatch.join(', ').toUpperCase(), confidence: 0.82 }

    // Invoice Number
    const invMatch = fullText.match(/((?:invoice|发票|INV)[:\s#]*([A-Z0-9-]{5,}))/i)
    if (invMatch) extracted['发票号'] = { value: invMatch[0].replace(/invoice|发票|INV[:\s#]*/i, '').toUpperCase(), confidence: 0.88 }

    // PO Number
    const poMatch = fullText.match(/((?:PO|P\.O\.|采购订单)[:\s#]*([A-Z0-9-]{4,}))/i)
    if (poMatch) extracted['采购订单号'] = { value: poMatch[0].replace(/PO|P\.O\.|采购订单[:\s#]*/i, '').toUpperCase(), confidence: 0.8 }

    // ETA / ETD
    const etaMatch = fullText.match(/ETA[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i)
    if (etaMatch) extracted['ETA'] = { value: etaMatch[1], confidence: 0.78 }

    const etdMatch = fullText.match(/ETD[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i)
    if (etdMatch) extracted['ETD'] = { value: etdMatch[1], confidence: 0.78 }

    // Port
    const portMatch = fullText.match(/((?:上海|深圳|广州|宁波|青岛|天津|厦门|大连|连云港|香港|Shanghai|Shenzhen|Guangzhou|Ningbo|Qingdao|Tianjin|Xiamen|Dalian)\s*(?:港|Port)?)/i)
    if (portMatch) extracted['港口'] = { value: portMatch[0], confidence: 0.75 }

    // Country
    const countryMatch = fullText.match(/(日本|韩国|美国|德国|泰国|越南|马来西亚|新加坡|印度|Japan|Korea|USA|Germany|Thailand|Vietnam|Malaysia|Singapore|India)/i)
    if (countryMatch) extracted['国家'] = { value: countryMatch[0], confidence: 0.72 }

    // HS Code
    const hsMatch = fullText.match(/(\d{4}\.\d{2}\.\d{4}|\d{4}\.\d{2}\.\d{2})/)
    if (hsMatch) extracted['HS编码'] = { value: hsMatch[0], confidence: 0.7 }

    // Deadline
    const deadlineMatch = fullText.match(/(?:截止|到期|deadline|due|before)[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i)
    if (deadlineMatch) extracted['截止日期'] = { value: deadlineMatch[1], confidence: 0.76 }

    // Customer from linked_client
    if (comm.linked_client_id) {
      const client = db.prepare('SELECT company_name FROM clients WHERE id = ?').get(comm.linked_client_id) as { company_name: string } | undefined
      if (client) extracted['客户'] = { value: client.company_name, confidence: 0.98 }
    }

    /* ── 3. CASE MATCHING ──────────────────────── */
    let caseMatch: { case_id: string; case_no: string; confidence: number; matchReason: string } | null = null

    // Try B/L match first
    if (extracted['提单号']) {
      const blCase = db.prepare(
        "SELECT id, case_no FROM cases WHERE bill_of_lading LIKE ? AND deleted_at IS NULL LIMIT 1"
      ).get(`%${extracted['提单号'].value}%`) as { id: string; case_no: string } | undefined
      if (blCase) caseMatch = { case_id: blCase.id, case_no: blCase.case_no, confidence: 0.95, matchReason: '提单号匹配' }
    }

    // Try container match
    if (!caseMatch && extracted['集装箱号']) {
      const cnt = extracted['集装箱号'].value.split(',')[0].trim()
      const cntCase = db.prepare(
        "SELECT id, case_no FROM cases WHERE container_numbers LIKE ? AND deleted_at IS NULL LIMIT 1"
      ).get(`%${cnt}%`) as { id: string; case_no: string } | undefined
      if (cntCase) caseMatch = { case_id: cntCase.id, case_no: cntCase.case_no, confidence: 0.88, matchReason: '集装箱号匹配' }
    }

    // Try client + recent case
    if (!caseMatch && comm.linked_client_id) {
      const recentCase = db.prepare(
        "SELECT id, case_no FROM cases WHERE client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
      ).get(comm.linked_client_id) as { id: string; case_no: string } | undefined
      if (recentCase) caseMatch = { case_id: recentCase.id, case_no: recentCase.case_no, confidence: 0.72, matchReason: '客户最近的案件' }
    }

    // Suggested actions
    const suggestions: Array<{ action: string; label: string; params?: Record<string, unknown> }> = []
    if (comm.linked_case_id || caseMatch) {
      suggestions.push({ action: 'OPEN_CASE', label: '打开关联案件', params: { case_id: caseMatch?.case_id || comm.linked_case_id } })
    } else {
      suggestions.push({ action: 'LINK_CASE', label: '关联到已有案件' })
      suggestions.push({ action: 'CREATE_CASE', label: '创建新案件' })
    }
    if (!comm.linked_client_id) suggestions.push({ action: 'LINK_CLIENT', label: '关联到客户' })
    suggestions.push({ action: 'CREATE_TASK', label: '创建待办任务' })

    if (classification.category === 'INVOICE' || classification.category === 'PACKING_LIST') {
      suggestions.push({ action: 'VERIFY_DOCS', label: '核实单据信息' })
    }
    if (classification.category === 'CUSTOMS_NOTICE') {
      suggestions.push({ action: 'REVIEW_NOTICE', label: '审阅海关通知' })
    }

    // Generate summary
    const summaryParts: string[] = [`这是一条${commTypeLabel(comm.comm_type as string)}沟通记录`]
    if (comm.from_name) summaryParts.push(`来自 ${comm.from_name}`)
    if (comm.subject) summaryParts.push(`主题为"${comm.subject}"`)
    summaryParts.push(`AI 分类: ${catLabel(classification.category)} (置信度 ${Math.round(classification.confidence*100)}%)`)
    if (caseMatch) summaryParts.push(`已匹配到案件 ${caseMatch.case_no}`)
    if (Object.keys(extracted).length > 0) summaryParts.push(`提取到 ${Object.keys(extracted).length} 个关键字段`)
    const summary = summaryParts.join('。')

    // Save AI results
    db.prepare(
      `UPDATE communications SET
        ai_processed = 1, ai_summary = ?, ai_extracted_fields = ?,
        ai_intent = ?, ai_intent_confidence = ?, ai_suggested_actions = ?,
        ai_analyzed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(summary, JSON.stringify(extracted), classification.category, classification.confidence, JSON.stringify(suggestions), commId)

    return {
      success: true,
      summary,
      classification: { category: classification.category, label: catLabel(classification.category), confidence: classification.confidence, reasoning: classification.reasoning },
      extractedFields: extracted,
      caseMatch,
      suggestedActions: suggestions,
    }
  })

  // ── ACCEPT SUGGESTION ─────────────────────────────
  ipcMain.handle('communications:acceptSuggestion', (_event, commId: string, actionType: string, params: Record<string, unknown>, userId: string) => {
    logAudit(db, 'AI_SUGGESTION_ACCEPTED', userId, `接受 AI 建议: ${actionType}`, { comm_id: commId, action_type: actionType, params })
    return { success: true }
  })

  // ── REJECT SUGGESTION ─────────────────────────────
  ipcMain.handle('communications:rejectSuggestion', (_event, commId: string, actionType: string, userId: string) => {
    logAudit(db, 'AI_SUGGESTION_REJECTED', userId, `拒绝 AI 建议: ${actionType}`, { comm_id: commId, action_type: actionType })
    return { success: true }
  })
}

/* ── Helpers ─────────────────────────────────── */

function serializeComm(row: Record<string, unknown>) {
  return {
    ...row,
    participants: tryParse(row.participants as string),
    tags: tryParse(row.tags as string),
    ai_extracted_fields: tryParse(row.ai_extracted_fields as string),
    ai_suggested_actions: tryParse(row.ai_suggested_actions as string),
    linked_document_ids: tryParse(row.linked_document_ids as string),
  }
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}

function commTypeLabel(t: string): string {
  const m: Record<string, string> = {
    EMAIL: '邮件', PHONE_CALL: '电话', MEETING: '会议', WECHAT: '微信',
    DOCUMENT: '文档上传', OCR_IMPORT: 'OCR导入',
    MANUAL: '手动记录', INTERNAL_NOTE: '内部备注', OTHER: '其他'
  }
  return m[t] || t
}

function intentLabel(t: string): string {
  const m: Record<string, string> = {
    DOCUMENT_SUBMISSION: '文件提交', STATUS_INQUIRY: '状态查询',
    URGENT_REQUEST: '紧急请求', SHIPPING_UPDATE: '物流更新',
    INSPECTION_NOTICE: '查验通知', PAYMENT_RELATED: '付款相关',
    COMPLAINT: '投诉', DOCUMENT_CORRECTION: '文件更正', OTHER: '其他'
  }
  return m[t] || t
}

function catLabel(t: string): string {
  const m: Record<string, string> = {
    BILL_OF_LADING: '提单', INVOICE: '发票', PACKING_LIST: '装箱单',
    CERTIFICATE: '证书文件', CUSTOMS_NOTICE: '海关通知',
    SHIPPING_UPDATE: '物流更新', INSPECTION: '查验',
    CUSTOMER_REQUEST: '客户请求', SUPPLIER_COMM: '供应商沟通',
    PAYMENT: '付款相关', URGENT: '紧急', BUSINESS: '商务沟通',
    NEWSLETTER: '新闻通讯', MARKETING: '营销邮件', SPAM: '垃圾邮件',
    INTERNAL: '内部沟通', UNKNOWN: '未分类'
  }
  return m[t] || t
}

function logAudit(db: ReturnType<typeof getDatabase>, type: string, userId: string, title: string, metadata: Record<string, unknown> | null = null) {
  // Use a generic case_id since activity_log requires it
  const id = uuid()
  db.prepare(
    `INSERT INTO activity_log (id, case_id, user_id, activity_type, title, content, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, '00000000-0000-0000-0000-000000000000', userId, type, title, null, metadata ? JSON.stringify(metadata) : null)
}
