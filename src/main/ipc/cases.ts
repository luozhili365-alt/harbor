import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { v4 as uuid } from 'uuid'

function generateCaseNo(db: ReturnType<typeof getDatabase>): string {
  const year = new Date().getFullYear()
  const row = db
    .prepare("SELECT COUNT(*) as count FROM cases WHERE case_no LIKE ?")
    .get(`CB-${year}-%`) as { count: number }
  const next = (row.count || 0) + 1
  return `CB-${year}-${String(next).padStart(4, '0')}`
}

function logActivity(
  db: ReturnType<typeof getDatabase>,
  caseId: string,
  userId: string | null,
  type: string,
  title: string | null,
  content: string | null = null,
  metadata: Record<string, unknown> | null = null
): void {
  db.prepare(
    `INSERT INTO activity_log (id, case_id, user_id, activity_type, title, content, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), caseId, userId, type, title, content, metadata ? JSON.stringify(metadata) : null)
}

export function registerCaseHandlers(): void {
  const db = getDatabase()

  // ── LIST ──────────────────────────────────────────
  ipcMain.handle('cases:list', (_event, filters: Record<string, string> = {}) => {
    const { status, clientId, type, priority, q, limit = '30', offset = '0' } = filters

    let where = 'WHERE c.deleted_at IS NULL'
    const params: unknown[] = []

    if (status) { where += ' AND c.status = ?'; params.push(status) }
    if (clientId) { where += ' AND c.client_id = ?'; params.push(clientId) }
    if (type) { where += ' AND c.type = ?'; params.push(type) }
    if (priority) { where += ' AND c.priority = ?'; params.push(priority) }
    if (q) {
      where += ' AND (c.case_no LIKE ? OR c.bill_of_lading LIKE ? OR c.declaration_number LIKE ?)'
      const like = `%${q}%`
      params.push(like, like, like)
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM cases c ${where}`
    ).get(...params) as { total: number }

    const items = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id
       ${where}
       ORDER BY c.updated_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, parseInt(limit), parseInt(offset))

    return {
      items: items.map(serializeCase),
      total: countRow.total
    }
  })

  // ── GET BY ID ─────────────────────────────────────
  ipcMain.handle('cases:getById', (_event, caseId: string) => {
    const c = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name
       FROM cases c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = ? AND c.deleted_at IS NULL`
    ).get(caseId)

    if (!c) return null

    const items = db.prepare(
      'SELECT * FROM case_items WHERE case_id = ? ORDER BY sequence_no'
    ).all(caseId)

    return { ...serializeCase(c), items: items.map(serializeItem) }
  })

  // ── CREATE ────────────────────────────────────────
  ipcMain.handle('cases:create', (_event, data: Record<string, unknown>, userId: string) => {
    const id = uuid()
    const caseNo = generateCaseNo(db)

    db.prepare(
      `INSERT INTO cases (id, case_no, client_id, assigned_to, type, supervision_mode,
        transaction_method, transport_mode, port_of_entry, port_of_departure,
        country_of_origin, country_of_destination, trade_country,
        declared_currency, declared_value, freight_amount, insurance_amount,
        bill_of_lading, vessel_name, voyage_number, container_numbers,
        estimated_arrival, priority, declaration_number, internal_notes,
        deadline_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, caseNo,
      data.clientId, data.assignedTo || null, data.type,
      data.supervisionMode || null, data.transactionMethod || null,
      data.transportMode || null, data.portOfEntry || null,
      data.portOfDeparture || null, data.countryOfOrigin || null,
      data.countryOfDestination || null, data.tradeCountry || null,
      data.declaredCurrency || 'USD', data.declaredValue || null,
      data.freightAmount || null, data.insuranceAmount || null,
      data.billOfLading || null, data.vesselName || null,
      data.voyageNumber || null,
      data.containerNumbers ? JSON.stringify(data.containerNumbers) : null,
      data.estimatedArrival || null, data.priority || 'NORMAL',
      data.declarationNumber || null, data.internalNotes || null,
      data.deadlineDate || null, userId
    )

    logActivity(db, id, userId, 'CASE_CREATED', `创建案件 ${caseNo}`)

    db.prepare(
      `INSERT INTO workflow_stages (id, case_id, stage, entered_at, entered_by, entered_reason)
       VALUES (?, ?, 'NEW', datetime('now'), ?, 'Case created')`
    ).run(uuid(), id, userId)

    return { id, caseNo }
  })

  // ── UPDATE ────────────────────────────────────────
  ipcMain.handle('cases:update', (_event, caseId: string, data: Record<string, unknown>, userId: string) => {
    const fields: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      assignedTo: 'assigned_to', type: 'type', status: 'status',
      supervisionMode: 'supervision_mode', transactionMethod: 'transaction_method',
      transportMode: 'transport_mode', portOfEntry: 'port_of_entry',
      portOfDeparture: 'port_of_departure', countryOfOrigin: 'country_of_origin',
      countryOfDestination: 'country_of_destination', tradeCountry: 'trade_country',
      declaredCurrency: 'declared_currency', declaredValue: 'declared_value',
      freightAmount: 'freight_amount', insuranceAmount: 'insurance_amount',
      dutiesEstimated: 'duties_estimated', vatEstimated: 'vat_estimated',
      billOfLading: 'bill_of_lading', vesselName: 'vessel_name',
      voyageNumber: 'voyage_number', estimatedArrival: 'estimated_arrival',
      priority: 'priority', declarationNumber: 'declaration_number',
      internalNotes: 'internal_notes', deadlineDate: 'deadline_date',
      assignedTeam: 'assigned_team', tags: 'tags'
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        if (key === 'containerNumbers') {
          values.push(JSON.stringify(data[key]))
        } else {
          values.push(data[key])
        }
      }
    }

    if (fields.length === 0) return { success: false, error: 'No fields to update' }

    fields.push("updated_at = datetime('now')")
    values.push(caseId)

    db.prepare(`UPDATE cases SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logActivity(db, caseId, userId, 'CASE_UPDATED', '更新案件信息')

    return { success: true }
  })

  // ── UPDATE STATUS ─────────────────────────────────
  ipcMain.handle('cases:updateStatus', (_event, caseId: string, newStatus: string, userId: string, note?: string) => {
    const c = db.prepare('SELECT status FROM cases WHERE id = ?').get(caseId) as { status: string } | undefined
    if (!c) return { success: false, error: '案件不存在' }

    const now = new Date().toISOString()
    const updates: string[] = ['status = ?']
    const values: unknown[] = [newStatus]

    if (newStatus === 'SUBMITTED') { updates.push('submitted_at = ?'); values.push(now) }
    if (newStatus === 'CLEARED') { updates.push('cleared_at = ?'); values.push(now) }
    if (newStatus === 'CLOSED') { updates.push('closed_at = ?'); values.push(now) }

    updates.push("updated_at = datetime('now')")
    values.push(caseId)

    db.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    logActivity(db, caseId, userId, 'STATUS_CHANGED',
      `状态变更: ${c.status} → ${newStatus}`,
      note, { from: c.status, to: newStatus }
    )

    return { success: true }
  })

  // ── DELETE ────────────────────────────────────────
  ipcMain.handle('cases:delete', (_event, caseId: string, userId: string) => {
    db.prepare("UPDATE cases SET deleted_at = datetime('now') WHERE id = ?").run(caseId)
    logActivity(db, caseId, userId, 'CASE_DELETED', '删除案件')
    return { success: true }
  })

  // ── TIMELINE ──────────────────────────────────────
  ipcMain.handle('cases:getTimeline', (_event, caseId: string, limit = 50) => {
    const items = db.prepare(
      `SELECT * FROM activity_log WHERE case_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(caseId, limit)
    return items.map(serializeActivity)
  })

  // ── ITEMS ─────────────────────────────────────────
  ipcMain.handle('cases:addItem', (_event, caseId: string, data: Record<string, unknown>) => {
    const id = uuid()
    db.prepare(
      `INSERT INTO case_items (id, case_id, sequence_no, product_name, product_name_en,
        brand, model, specification, hs_code, hs_code_confidence, declaration_elements,
        quantity, unit, unit_price, total_price, currency, duty_rate, vat_rate,
        consumption_tax_rate, country_of_origin, requires_permit, permit_type, requires_ciq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, caseId, data.sequenceNo, data.productName, data.productNameEn || null,
      data.brand || null, data.model || null, data.specification || null,
      data.hsCode || null, data.hsCodeConfidence || null,
      data.declarationElements ? JSON.stringify(data.declarationElements) : null,
      data.quantity || null, data.unit || null, data.unitPrice || null,
      data.totalPrice || null, data.currency || 'USD',
      data.dutyRate || null, data.vatRate || null, data.consumptionTaxRate || null,
      data.countryOfOrigin || null, data.requiresPermit ? 1 : 0,
      data.permitType || null, data.requiresCiq ? 1 : 0
    )
    return { id }
  })

  ipcMain.handle('cases:updateItem', (_event, itemId: string, data: Record<string, unknown>) => {
    const fields: string[] = []
    const values: unknown[] = []
    const map: Record<string, string> = {
      sequenceNo: 'sequence_no', productName: 'product_name',
      productNameEn: 'product_name_en', brand: 'brand', model: 'model',
      specification: 'specification', hsCode: 'hs_code',
      hsCodeConfidence: 'hs_code_confidence', quantity: 'quantity',
      unit: 'unit', unitPrice: 'unit_price', totalPrice: 'total_price',
      currency: 'currency', dutyRate: 'duty_rate', vatRate: 'vat_rate',
      consumptionTaxRate: 'consumption_tax_rate',
      countryOfOrigin: 'country_of_origin', requiresPermit: 'requires_permit',
      permitType: 'permit_type', requiresCiq: 'requires_ciq'
    }
    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        if (key === 'declarationElements') {
          values.push(JSON.stringify(data[key]))
        } else {
          values.push(data[key])
        }
      }
    }
    if (fields.length === 0) return { success: false }
    values.push(itemId)
    db.prepare(`UPDATE case_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  ipcMain.handle('cases:deleteItem', (_event, itemId: string) => {
    db.prepare('DELETE FROM case_items WHERE id = ?').run(itemId)
    return { success: true }
  })

  // ── GET DOCUMENTS ─────────────────────────────────
  ipcMain.handle('cases:getDocuments', (_event, caseId: string) => {
    const docs = db.prepare(
      `SELECT * FROM documents WHERE case_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
    ).all(caseId) as unknown[]

    const checklist = db.prepare(
      `SELECT * FROM document_checklist WHERE case_id = ? ORDER BY tier, doc_type`
    ).all(caseId)

    return {
      documents: docs.map((d) => serializeDoc(d as Record<string, unknown>)),
      checklist: checklist
    }
  })

  // ── GET RISK ANALYSIS ─────────────────────────────
  ipcMain.handle('cases:getRiskAnalysis', (_event, caseId: string) => {
    const risks: Array<{
      type: string; title: string; description: string; severity: string; confidence: number; suggested_action: string
    }> = []

    const c = db.prepare('SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL').get(caseId) as Record<string, unknown> | undefined
    if (!c) return { risks }

    // 1. Missing required documents
    const missingDocs = db.prepare(
      "SELECT COUNT(*) as c FROM document_checklist WHERE case_id = ? AND is_required = 1 AND status NOT IN ('RECEIVED','VERIFIED')"
    ).get(caseId) as { c: number }
    if (missingDocs.c > 0) {
      risks.push({
        type: 'MISSING_DOCUMENTS', title: '缺失必要文件',
        description: `有 ${missingDocs.c} 份必要文件尚未收到`,
        severity: 'HIGH', confidence: 0.95,
        suggested_action: '联系客户补充缺失文件'
      })
    }

    // 2. Deadline conflicts
    const overdueTasks = db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE case_id = ? AND deleted_at IS NULL AND status = 'PENDING' AND due_date < datetime('now')"
    ).get(caseId) as { c: number }
    if (overdueTasks.c > 0) {
      risks.push({
        type: 'OVERDUE_TASKS', title: '任务逾期',
        description: `有 ${overdueTasks.c} 个任务已逾期`,
        severity: 'HIGH', confidence: 0.98,
        suggested_action: '检查逾期任务并重新安排优先级'
      })
    }

    const dueSoon = db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE case_id = ? AND deleted_at IS NULL AND status = 'PENDING' AND due_date BETWEEN datetime('now') AND datetime('now', '+2 days')"
    ).get(caseId) as { c: number }
    if (dueSoon.c > 0) {
      risks.push({
        type: 'UPCOMING_DEADLINES', title: '即将到期',
        description: `有 ${dueSoon.c} 个任务在 2 天内到期`,
        severity: 'MEDIUM', confidence: 0.98,
        suggested_action: '优先处理即将到期的任务'
      })
    }

    // 3. Incomplete key information
    const missingFields: string[] = []
    if (!c.bill_of_lading) missingFields.push('提单号')
    if (!c.port_of_entry && !c.port_of_departure) missingFields.push('口岸信息')
    if (!c.declared_value) missingFields.push('申报金额')
    if (!c.vessel_name) missingFields.push('船名')
    if (missingFields.length > 0) {
      risks.push({
        type: 'INCOMPLETE_INFO', title: '关键信息缺失',
        description: `缺少: ${missingFields.join('、')}`,
        severity: 'MEDIUM', confidence: 0.9,
        suggested_action: '补充缺失的报关关键信息'
      })
    }

    // 4. Stalled case detection
    const lastActivity = db.prepare(
      "SELECT MAX(created_at) as last_activity FROM activity_log WHERE case_id = ?"
    ).get(caseId) as { last_activity: string | null }
    if (lastActivity?.last_activity) {
      const daysStalled = db.prepare(
        "SELECT (julianday('now') - julianday(?)) as days"
      ).get(lastActivity.last_activity) as { days: number }
      if (daysStalled.days > 7) {
        risks.push({
          type: 'STALLED', title: '案件停滞',
          description: `已 ${Math.round(daysStalled.days)} 天无活动`,
          severity: 'MEDIUM', confidence: 0.85,
          suggested_action: '检查案件进展，确认是否有阻碍'
        })
      }
    }

    // 5. Low confidence HS codes
    const lowConfItems = db.prepare(
      "SELECT COUNT(*) as c FROM case_items WHERE case_id = ? AND hs_code_confidence IS NOT NULL AND hs_code_confidence < 0.7"
    ).get(caseId) as { c: number }
    if (lowConfItems.c > 0) {
      risks.push({
        type: 'LOW_HS_CONFIDENCE', title: 'HS 编码置信度低',
        description: `有 ${lowConfItems.c} 个商品的 HS 编码置信度低于 70%`,
        severity: 'LOW', confidence: 0.75,
        suggested_action: '人工核实 HS 编码分类'
      })
    }

    return { risks }
  })

  // ── ARCHIVE ──────────────────────────────────────
  ipcMain.handle('cases:archive', (_event, caseId: string, userId: string) => {
    db.prepare("UPDATE cases SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(caseId)
    logActivity(db, caseId, userId, 'CASE_ARCHIVED', '归档案件')
    return { success: true }
  })

  // ── RESTORE ──────────────────────────────────────
  ipcMain.handle('cases:restore', (_event, caseId: string, userId: string) => {
    db.prepare("UPDATE cases SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(caseId)
    logActivity(db, caseId, userId, 'CASE_RESTORED', '恢复案件')
    return { success: true }
  })

  // ── ASSIGN TEAM ──────────────────────────────────
  ipcMain.handle('cases:assignTeam', (_event, caseId: string, team: string, userId: string) => {
    db.prepare("UPDATE cases SET assigned_team = ?, updated_at = datetime('now') WHERE id = ?").run(team, caseId)
    logActivity(db, caseId, userId, 'TEAM_ASSIGNED', `分配给团队: ${team}`)
    return { success: true }
  })

  // ── EXPORT ───────────────────────────────────────
  ipcMain.handle('cases:export', (_event, caseId: string) => {
    const c = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name
       FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id WHERE c.id = ?`
    ).get(caseId)
    if (!c) return null

    const items = db.prepare('SELECT * FROM case_items WHERE case_id = ? ORDER BY sequence_no').all(caseId)
    const timeline = db.prepare('SELECT * FROM activity_log WHERE case_id = ? ORDER BY created_at DESC').all(caseId)
    const docs = db.prepare('SELECT * FROM documents WHERE case_id = ? AND deleted_at IS NULL').all(caseId)
    const comms = db.prepare('SELECT * FROM communications WHERE linked_case_id = ? AND deleted_at IS NULL').all(caseId)
    const tasks = db.prepare('SELECT * FROM tasks WHERE case_id = ? AND deleted_at IS NULL').all(caseId)

    return {
      case: serializeCase(c as Record<string, unknown>),
      items: (items as unknown[]).map(i => serializeItem(i as Record<string, unknown>)),
      timeline: (timeline as unknown[]).map(i => serializeActivity(i as Record<string, unknown>)),
      documents: docs,
      communications: comms,
      tasks,
      exportedAt: new Date().toISOString()
    }
  })

  // ── GET SUMMARY ──────────────────────────────────
  ipcMain.handle('cases:getSummary', (_event, caseId: string) => {
    const c = db.prepare(
      `SELECT c.*, cl.company_name as client_name, u.name as assigned_to_name
       FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN users u ON c.assigned_to = u.id WHERE c.id = ?`
    ).get(caseId) as Record<string, unknown> | undefined
    if (!c) return null

    const itemCount = (db.prepare('SELECT COUNT(*) as c FROM case_items WHERE case_id = ?').get(caseId) as {c:number}).c
    const docCount = (db.prepare('SELECT COUNT(*) as c FROM documents WHERE case_id = ? AND deleted_at IS NULL').get(caseId) as {c:number}).c
    const taskPending = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE case_id = ? AND deleted_at IS NULL AND status = 'PENDING'").get(caseId) as {c:number}).c
    const taskDone = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE case_id = ? AND deleted_at IS NULL AND status != 'PENDING'").get(caseId) as {c:number}).c
    const commCount = (db.prepare('SELECT COUNT(*) as c FROM communications WHERE linked_case_id = ? AND deleted_at IS NULL').get(caseId) as {c:number}).c

    const missingDocs = db.prepare(
      "SELECT doc_name_cn FROM document_checklist WHERE case_id = ? AND is_required = 1 AND status NOT IN ('RECEIVED','VERIFIED')"
    ).all(caseId) as { doc_name_cn: string }[]

    return {
      caseNo: c.case_no,
      clientName: c.client_name,
      type: c.type === 'IMPORT' ? '进口' : '出口',
      status: c.status,
      priority: c.priority,
      assignedTo: c.assigned_to_name,
      itemCount,
      docCount,
      taskPending,
      taskDone,
      commCount,
      missingDocs: missingDocs.map(d => d.doc_name_cn),
      billOfLading: c.bill_of_lading,
      estimatedArrival: c.estimated_arrival,
      portOfEntry: c.port_of_entry,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }
  })
}

// ── Serialization helpers ───────────────────────────
function serializeDoc(row: Record<string, unknown>) {
  return {
    ...row,
    extracted_data: tryParse(row.extracted_data as string)
  }
}

function serializeCase(row: Record<string, unknown>) {
  return {
    ...row,
    containerNumbers: tryParse(row.container_numbers as string),
    tags: tryParse(row.tags as string),
    aiRiskFactors: tryParse(row.ai_risk_factors as string)
  }
}

function serializeItem(row: Record<string, unknown>) {
  return {
    ...row,
    declarationElements: tryParse(row.declaration_elements as string),
    requiresPermit: !!row.requires_permit,
    requiresCiq: !!row.requires_ciq
  }
}

function serializeActivity(row: Record<string, unknown>) {
  return {
    ...row,
    metadata: tryParse(row.metadata as string)
  }
}

function tryParse(val: string | null): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}
