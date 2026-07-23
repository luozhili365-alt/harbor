import Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    -- ============================================================
    -- USERS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'broker',
      mfa_secret TEXT,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      avatar_url TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- CLIENTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_name_en TEXT,
      legal_name TEXT,
      country TEXT,
      website TEXT,
      industry TEXT,
      tax_number TEXT,
      registration_number TEXT,
      preferred_language TEXT,
      preferred_timezone TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PROSPECT','INACTIVE','ARCHIVED')),
      risk_level TEXT DEFAULT 'LOW' CHECK(risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
      account_manager TEXT REFERENCES users(id),
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      contact_wechat TEXT,
      usc_code TEXT,
      customs_code TEXT,
      customs_grade TEXT,
      tax_id TEXT,
      address TEXT,
      billing_email TEXT,
      service_fee_standard TEXT,
      notes TEXT,
      internal_notes TEXT,
      tags TEXT,
      health_score REAL,
      health_factors TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(company_name);
    CREATE INDEX IF NOT EXISTS idx_clients_customs ON clients(customs_code);
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_clients_risk ON clients(risk_level);

    -- ============================================================
    -- CLIENT CONTACTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS client_contacts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      position TEXT,
      department TEXT,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      preferred_comm TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_client ON client_contacts(client_id);

    -- ============================================================
    -- CALENDAR EVENTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL DEFAULT 'MANUAL',
      start_time TEXT NOT NULL,
      end_time TEXT,
      all_day INTEGER NOT NULL DEFAULT 0,
      priority TEXT DEFAULT 'NORMAL',
      status TEXT DEFAULT 'CONFIRMED',
      owner_id TEXT REFERENCES users(id),
      case_id TEXT REFERENCES cases(id),
      client_id TEXT REFERENCES clients(id),
      document_id TEXT REFERENCES documents(id),
      task_id TEXT REFERENCES tasks(id),
      location TEXT,
      color TEXT,
      tags TEXT,
      is_ai_suggested INTEGER NOT NULL DEFAULT 0,
      ai_confidence REAL,
      ai_reason TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_calendar_case ON calendar_events(case_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_owner ON calendar_events(owner_id);

    -- ============================================================
    -- REMINDERS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      reminder_type TEXT NOT NULL DEFAULT 'MANUAL',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'PENDING',
      due_date TEXT NOT NULL,
      due_time TEXT,
      owner_id TEXT REFERENCES users(id),
      case_id TEXT REFERENCES cases(id),
      client_id TEXT REFERENCES clients(id),
      document_id TEXT REFERENCES documents(id),
      source_module TEXT DEFAULT 'MANUAL',
      is_ai_suggested INTEGER NOT NULL DEFAULT 0,
      ai_confidence REAL,
      ai_reason TEXT,
      snooze_until TEXT,
      recurrence_rule TEXT,
      escalation_level INTEGER DEFAULT 0,
      tags TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      completed_by TEXT REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
    CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
    CREATE INDEX IF NOT EXISTS idx_reminders_case ON reminders(case_id);

    -- ============================================================
    -- AI RECOMMENDATIONS (unified across all modules)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      rec_type TEXT NOT NULL,
      source_module TEXT NOT NULL,
      priority TEXT DEFAULT 'MEDIUM',
      confidence REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      suggested_action TEXT,
      related_case_id TEXT REFERENCES cases(id),
      related_client_id TEXT REFERENCES clients(id),
      related_document_id TEXT REFERENCES documents(id),
      related_comm_id TEXT REFERENCES communications(id),
      context_json TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_rec_status ON ai_recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_ai_rec_module ON ai_recommendations(source_module);

    -- ============================================================
    -- RISKS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'OPERATIONAL',
      level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(level IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
      status TEXT NOT NULL DEFAULT 'OPEN',
      confidence REAL NOT NULL DEFAULT 0.8,
      reason TEXT,
      evidence TEXT,
      related_case_id TEXT REFERENCES cases(id),
      related_client_id TEXT REFERENCES clients(id),
      related_document_id TEXT REFERENCES documents(id),
      related_reminder_id TEXT REFERENCES reminders(id),
      related_comm_id TEXT REFERENCES communications(id),
      owner_id TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      resolved_at TEXT,
      resolved_by TEXT REFERENCES users(id),
      tags TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_risks_level ON risks(level);
    CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
    CREATE INDEX IF NOT EXISTS idx_risks_case ON risks(related_case_id);
    CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category);

    -- ============================================================
    -- CASES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_no TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL REFERENCES clients(id),
      assigned_to TEXT REFERENCES users(id),
      assigned_team TEXT,
      type TEXT NOT NULL CHECK(type IN ('IMPORT', 'EXPORT')),
      status TEXT NOT NULL DEFAULT 'NEW',
      supervision_mode TEXT,
      transaction_method TEXT,
      transport_mode TEXT,
      port_of_entry TEXT,
      port_of_departure TEXT,
      country_of_origin TEXT,
      country_of_destination TEXT,
      trade_country TEXT,
      declared_currency TEXT NOT NULL DEFAULT 'USD',
      declared_value REAL,
      freight_amount REAL,
      insurance_amount REAL,
      duties_estimated REAL,
      vat_estimated REAL,
      consumption_tax REAL,
      duties_paid REAL,
      vat_paid REAL,
      bill_of_lading TEXT,
      vessel_name TEXT,
      voyage_number TEXT,
      container_numbers TEXT,
      estimated_arrival TEXT,
      actual_arrival TEXT,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      declaration_number TEXT,
      ai_risk_score REAL,
      ai_risk_factors TEXT,
      internal_notes TEXT,
      tags TEXT,
      deadline_date TEXT,
      submitted_at TEXT,
      cleared_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      created_by TEXT REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
    CREATE INDEX IF NOT EXISTS idx_cases_assigned ON cases(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_cases_bl ON cases(bill_of_lading);
    CREATE INDEX IF NOT EXISTS idx_cases_declaration ON cases(declaration_number);

    -- ============================================================
    -- CASE ITEMS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS case_items (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      sequence_no INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_name_en TEXT,
      brand TEXT,
      model TEXT,
      specification TEXT,
      hs_code TEXT,
      hs_code_confidence REAL,
      declaration_elements TEXT,
      quantity REAL,
      unit TEXT,
      unit_price REAL,
      total_price REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      duty_rate REAL,
      vat_rate REAL DEFAULT 13.0,
      consumption_tax_rate REAL,
      country_of_origin TEXT,
      requires_permit INTEGER NOT NULL DEFAULT 0,
      permit_type TEXT,
      requires_ciq INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_case_items_case ON case_items(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_items_hs ON case_items(hs_code);

    -- ============================================================
    -- DOCUMENTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      case_id TEXT REFERENCES cases(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER,
      doc_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
      extracted_data TEXT,
      extraction_confidences TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT,
      ocr_text TEXT,
      ocr_status TEXT NOT NULL DEFAULT 'PENDING',
      ocr_engine TEXT,
      sha256_hash TEXT,
      uploaded_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(sha256_hash);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

    -- ============================================================
    -- EMAILS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      from_addr TEXT NOT NULL,
      from_name TEXT,
      to_addrs TEXT NOT NULL,
      cc_addrs TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      snippet TEXT,
      direction TEXT NOT NULL CHECK(direction IN ('INBOUND', 'OUTBOUND')),
      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachment_ids TEXT,
      ai_processed INTEGER NOT NULL DEFAULT 0,
      ai_category TEXT,
      ai_priority TEXT,
      ai_summary TEXT,
      ai_action_needed INTEGER,
      ai_suggested_case_id TEXT,
      status TEXT NOT NULL DEFAULT 'UNREAD',
      linked_case_id TEXT REFERENCES cases(id),
      linked_manually INTEGER,
      forwarded_by TEXT,
      notes TEXT,
      received_at TEXT NOT NULL,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_emails_case ON emails(linked_case_id);
    CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);

    -- ============================================================
    -- EMAIL EXTRACTIONS (AI output storage)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS email_extractions (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id),
      ai_response TEXT NOT NULL,
      extracted_client_name TEXT,
      extracted_client_id TEXT REFERENCES clients(id),
      extracted_bl_number TEXT,
      extracted_container_nums TEXT,
      extracted_eta TEXT,
      extracted_etd TEXT,
      business_category TEXT,
      urgency TEXT,
      is_new_case INTEGER,
      matched_case_id TEXT REFERENCES cases(id),
      match_confidence REAL,
      overall_confidence REAL,
      extraction_version TEXT DEFAULT '1.0',
      broker_corrections TEXT,
      broker_rating INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_extractions_email ON email_extractions(email_id);
    CREATE INDEX IF NOT EXISTS idx_extractions_bl ON email_extractions(extracted_bl_number);
    CREATE INDEX IF NOT EXISTS idx_extractions_client ON email_extractions(extracted_client_id);
    CREATE INDEX IF NOT EXISTS idx_extractions_case ON email_extractions(matched_case_id);

    -- ============================================================
    -- COMMUNICATIONS (Inbox / Work Intake Center)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      comm_type TEXT NOT NULL CHECK(comm_type IN ('EMAIL','PHONE_CALL','MEETING','WECHAT','DOCUMENT','OCR_IMPORT','MANUAL','INTERNAL_NOTE','OTHER')),
      direction TEXT NOT NULL DEFAULT 'INBOUND' CHECK(direction IN ('INBOUND','OUTBOUND','INTERNAL')),
      status TEXT NOT NULL DEFAULT 'UNREAD' CHECK(status IN ('UNREAD','READ','ASSIGNED','WAITING','FLAGGED','ACTIONED','ARCHIVED')),
      priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),

      from_name TEXT,
      from_contact TEXT,
      participants TEXT,

      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      snippet TEXT,

      linked_case_id TEXT REFERENCES cases(id),
      linked_client_id TEXT REFERENCES clients(id),
      linked_document_ids TEXT,

      assigned_to TEXT REFERENCES users(id),

      ai_processed INTEGER NOT NULL DEFAULT 0,
      ai_summary TEXT,
      ai_extracted_fields TEXT,
      ai_intent TEXT,
      ai_intent_confidence REAL,
      ai_suggested_actions TEXT,
      ai_analyzed_at TEXT,

      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachment_ids TEXT,

      tags TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comm_status ON communications(status);
    CREATE INDEX IF NOT EXISTS idx_comm_type ON communications(comm_type);
    CREATE INDEX IF NOT EXISTS idx_comm_case ON communications(linked_case_id);
    CREATE INDEX IF NOT EXISTS idx_comm_client ON communications(linked_client_id);
    CREATE INDEX IF NOT EXISTS idx_comm_assigned ON communications(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_comm_priority ON communications(priority);

    -- ============================================================
    -- TASKS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      case_id TEXT REFERENCES cases(id),
      assigned_to TEXT REFERENCES users(id),
      task_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'PENDING',
      due_date TEXT NOT NULL,
      reminder_before TEXT,
      reminded_at TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule TEXT,
      created_by TEXT REFERENCES users(id),
      completed_by TEXT REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_case ON tasks(case_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    -- ============================================================
    -- ACTIVITY LOG (append-only)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      user_id TEXT REFERENCES users(id),
      activity_type TEXT NOT NULL,
      title TEXT,
      content TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_case ON activity_log(case_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(activity_type);

    -- ============================================================
    -- DOCUMENT CHECKLIST
    -- ============================================================
    CREATE TABLE IF NOT EXISTS document_checklist (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      doc_type TEXT NOT NULL,
      doc_name_cn TEXT NOT NULL,
      tier INTEGER NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 1,
      requirement_reason TEXT,
      status TEXT NOT NULL DEFAULT 'NOT_MENTIONED',
      linked_document_id TEXT REFERENCES documents(id),
      expected_by_date TEXT,
      deadline_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_checklist_case ON document_checklist(case_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_status ON document_checklist(case_id, status);

    -- ============================================================
    -- WORKFLOW STAGES (stage history per case)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS workflow_stages (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      stage TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      exited_at TEXT,
      entered_by TEXT NOT NULL,
      entered_reason TEXT,
      blockers_at_entry TEXT,
      duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_case ON workflow_stages(case_id, entered_at);

    -- ============================================================
    -- WORKFLOW BLOCKERS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS workflow_blockers (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      blocker_type TEXT NOT NULL,
      description TEXT NOT NULL,
      detail TEXT,
      severity TEXT NOT NULL DEFAULT 'BLOCKING',
      is_active INTEGER NOT NULL DEFAULT 1,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_blockers_case ON workflow_blockers(case_id);

    -- ============================================================
    -- REMINDER CASCADES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS reminder_cascades (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      milestone_type TEXT NOT NULL,
      milestone_label TEXT NOT NULL,
      milestone_date TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_by TEXT REFERENCES users(id),
      cascade_config TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_reason TEXT,
      previous_milestone_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cascade_case ON reminder_cascades(case_id);
    CREATE INDEX IF NOT EXISTS idx_cascade_milestone ON reminder_cascades(milestone_date);

    -- ============================================================
    -- REMINDER INSTANCES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS reminder_instances (
      id TEXT PRIMARY KEY,
      cascade_id TEXT NOT NULL REFERENCES reminder_cascades(id),
      case_id TEXT NOT NULL REFERENCES cases(id),
      fire_at TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'INFO',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      fired_at TEXT,
      acknowledged_at TEXT,
      resolved_at TEXT,
      notification_channels TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_instance_status ON reminder_instances(status, fire_at);
    CREATE INDEX IF NOT EXISTS idx_instance_case ON reminder_instances(case_id, status);
    CREATE INDEX IF NOT EXISTS idx_instance_fire ON reminder_instances(fire_at);

    -- ============================================================
    -- SUGGESTED UPDATES (low-confidence AI suggestions)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS suggested_updates (
      id TEXT PRIMARY KEY,
      email_id TEXT REFERENCES emails(id),
      case_id TEXT REFERENCES cases(id),
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      field_name TEXT NOT NULL,
      suggested_value TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT REFERENCES users(id),
      actual_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- AI FEEDBACK (broker corrections for learning)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id TEXT PRIMARY KEY,
      extraction_id TEXT REFERENCES email_extractions(id),
      field_path TEXT NOT NULL,
      ai_value TEXT,
      broker_value TEXT,
      context_snapshot TEXT,
      corrected_by TEXT REFERENCES users(id),
      correction_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- MAILBOXES (Communication Intelligence Engine)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      tls INTEGER NOT NULL DEFAULT 1,
      username TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      folders TEXT,
      sync_frequency INTEGER NOT NULL DEFAULT 15,
      last_synced_at TEXT,
      sync_status TEXT DEFAULT 'DISCONNECTED',
      error_message TEXT,
      total_synced INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // ── Migrations: add new columns to existing tables ──
  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      console.log(`[Migrate] Added ${table}.${column}`)
    }
  }

  try {
    // clients
    ensureColumn('clients', 'legal_name', 'TEXT')
    ensureColumn('clients', 'country', 'TEXT')
    ensureColumn('clients', 'website', 'TEXT')
    ensureColumn('clients', 'industry', 'TEXT')
    ensureColumn('clients', 'tax_number', 'TEXT')
    ensureColumn('clients', 'registration_number', 'TEXT')
    ensureColumn('clients', 'preferred_language', 'TEXT')
    ensureColumn('clients', 'preferred_timezone', 'TEXT')
    ensureColumn('clients', 'status', "TEXT DEFAULT 'ACTIVE'")
    ensureColumn('clients', 'risk_level', "TEXT DEFAULT 'LOW'")
    ensureColumn('clients', 'account_manager', 'TEXT')
    ensureColumn('clients', 'internal_notes', 'TEXT')
    ensureColumn('clients', 'health_score', 'REAL')
    ensureColumn('clients', 'health_factors', 'TEXT')
    // cases
    ensureColumn('cases', 'assigned_team', 'TEXT')
  } catch (err: any) {
    console.error('[Migrate] Error:', err.message)
  }
}
