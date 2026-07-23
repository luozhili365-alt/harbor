import { getDatabase } from './connection'
import { createSchema } from './schema'
import { v4 as uuid } from 'uuid'
import { createHash, randomBytes } from 'crypto'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(password + salt).digest('hex')
  return `${salt}:${hash}`
}

export function seedDatabase(): void {
  const db = getDatabase()
  createSchema(db)

  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (existing.c > 0) {
    console.log('[Seed] Database already has data. Skipping.')
    return
  }

  console.log('[Seed] Creating sample data...')

  // Create users
  const adminId = uuid()
  const brokerId = uuid()

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(adminId, '管理员', 'admin@harbor.com', hashPassword('admin123'), 'admin')

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(brokerId, '张三', 'broker@harbor.com', hashPassword('broker123'), 'broker')

  // Create clients
  const sonyId = uuid()
  const mitsubishiId = uuid()
  const toshibaId = uuid()

  db.prepare(
    `INSERT INTO clients (id, company_name, company_name_en, contact_person, contact_phone, contact_email, customs_code, customs_grade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sonyId, '索尼电子(深圳)有限公司', 'Sony Electronics (Shenzhen) Co., Ltd.', '李经理', '13800138001', 'lmg@sony.com.cn', '4403940001', '高级认证')

  db.prepare(
    `INSERT INTO clients (id, company_name, company_name_en, contact_person, contact_phone, contact_email, customs_code, customs_grade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(mitsubishiId, '三菱电机(上海)有限公司', 'Mitsubishi Electric (Shanghai) Co., Ltd.', '王总监', '13800138002', 'wang@mitsubishi.com.cn', '3112940002', '一般认证')

  db.prepare(
    `INSERT INTO clients (id, company_name, company_name_en, contact_person, contact_phone, contact_email, customs_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(toshibaId, '东芝电子元器件(广州)有限公司', 'Toshiba Electronic Components (Guangzhou) Co., Ltd.', '陈经理', '13800138003', 'chen@toshiba.com.cn', '4401940003')

  // Create sample cases
  const case1Id = uuid()
  const case2Id = uuid()
  const case3Id = uuid()

  const now = new Date().toISOString()
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString()
  const yesterday = new Date(Date.now() - 86400000).toISOString()

  db.prepare(
    `INSERT INTO cases (id, case_no, client_id, assigned_to, type, status,
      supervision_mode, transaction_method, transport_mode, port_of_entry,
      country_of_origin, declared_currency, declared_value, bill_of_lading,
      vessel_name, voyage_number, estimated_arrival, priority, deadline_date,
      created_by, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    case1Id, 'CB-2026-0001', sonyId, brokerId, 'IMPORT', 'UNDER_REVIEW',
    '一般贸易', 'CIF', '海运', '深圳海关',
    '日本', 'USD', 85000, 'SZX20260715001',
    'EVER FORTUNE', 'V.123E', nextWeek, 'HIGH', yesterday,
    brokerId, new Date(Date.now() - 3 * 86400000).toISOString()
  )

  db.prepare(
    `INSERT INTO cases (id, case_no, client_id, assigned_to, type, status,
      supervision_mode, transaction_method, transport_mode, port_of_entry,
      country_of_origin, declared_currency, declared_value, bill_of_lading,
      vessel_name, voyage_number, estimated_arrival, priority, deadline_date,
      created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    case2Id, 'CB-2026-0002', mitsubishiId, brokerId, 'IMPORT', 'COLLECTING_DOCUMENTS',
    '一般贸易', 'FOB', '海运', '上海海关',
    '日本', 'JPY', 15000000, 'SHA20260720002',
    'MOL ENDOWMENT', 'V.045W', new Date(Date.now() + 14 * 86400000).toISOString(), 'NORMAL',
    new Date(Date.now() + 10 * 86400000).toISOString(),
    brokerId
  )

  db.prepare(
    `INSERT INTO cases (id, case_no, client_id, assigned_to, type, status,
      supervision_mode, transaction_method, transport_mode, port_of_departure,
      country_of_destination, declared_currency, declared_value, bill_of_lading,
      vessel_name, voyage_number, priority, deadline_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    case3Id, 'CB-2026-0003', toshibaId, adminId, 'EXPORT', 'READY',
    '一般贸易', 'FOB', '海运', '广州海关',
    '日本', 'USD', 42000, 'GZ20260710003',
    'COSCO SHIPPING', 'V.078E', 'URGENT',
    new Date(Date.now() + 86400000).toISOString(),
    brokerId
  )

  // Sample case items
  db.prepare(
    `INSERT INTO case_items (id, case_id, sequence_no, product_name, product_name_en, brand, model, hs_code, hs_code_confidence, quantity, unit, unit_price, total_price, currency, duty_rate, vat_rate, country_of_origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), case1Id, 1, '音响扬声器单元', 'Speaker Driver Unit SP-500', 'Sony', 'SP-500', '8518.2900.00', 0.92, 1000, '个', 50.00, 50000.00, 'USD', 10.0, 13.0, '日本')

  db.prepare(
    `INSERT INTO case_items (id, case_id, sequence_no, product_name, product_name_en, brand, model, hs_code, hs_code_confidence, quantity, unit, unit_price, total_price, currency, duty_rate, vat_rate, country_of_origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), case1Id, 2, '音频放大器模块', 'Audio Amplifier Module PA-200', 'Sony', 'PA-200', '8518.4000.00', 0.78, 500, '个', 70.00, 35000.00, 'USD', 10.0, 13.0, '日本')

  // Workflow stages
  db.prepare(
    'INSERT INTO workflow_stages (id, case_id, stage, entered_at, entered_by, entered_reason) VALUES (?, ?, ?, datetime(\'now\'), ?, ?)'
  ).run(uuid(), case1Id, 'UNDER_REVIEW', brokerId, 'Case submitted')

  db.prepare(
    'INSERT INTO workflow_stages (id, case_id, stage, entered_at, entered_by, entered_reason) VALUES (?, ?, ?, datetime(\'now\'), ?, ?)'
  ).run(uuid(), case2Id, 'COLLECTING_DOCUMENTS', brokerId, 'Waiting for documents')

  db.prepare(
    'INSERT INTO workflow_stages (id, case_id, stage, entered_at, entered_by, entered_reason) VALUES (?, ?, ?, datetime(\'now\'), ?, ?)'
  ).run(uuid(), case3Id, 'READY', brokerId, 'Ready to submit')

  // Activity log
  db.prepare(
    'INSERT INTO activity_log (id, case_id, user_id, activity_type, title, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(uuid(), case1Id, brokerId, 'CASE_CREATED', '创建案件 CB-2026-0001')

  db.prepare(
    'INSERT INTO activity_log (id, case_id, user_id, activity_type, title, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(uuid(), case2Id, brokerId, 'CASE_CREATED', '创建案件 CB-2026-0002')

  db.prepare(
    'INSERT INTO activity_log (id, case_id, user_id, activity_type, title, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(uuid(), case3Id, brokerId, 'CASE_CREATED', '创建案件 CB-2026-0003')

  console.log('[Seed] Done!')
  console.log('  Users: admin@harbor.com / admin123')
  console.log('         broker@harbor.com / broker123')
  console.log('  Clients: 3  |  Cases: 3')
}

// Seed runs inside Electron via initDatabase() auto-call, or via IPC
