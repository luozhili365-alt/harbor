# Reminder Engine — Complete Design

**Status:** Design Document
**Principle:** The engine auto-generates reminders from milestones so the broker doesn't HAVE to create them. But the broker CAN create, edit, dismiss, snooze, or override ANY reminder at ANY time. Automation is the default. Human control is the safety net. Both coexist.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [The Reminder Cascade Pattern](#2-the-reminder-cascade-pattern)
3. [Milestone Types & Their Cascades](#3-milestone-types)
4. [The Escalation Strategy](#4-the-escalation-strategy)
5. [Auto-Resolution: When Reminders Disappear](#5-auto-resolution)
6. [The Reminder Data Model](#6-the-reminder-data-model)
7. [How the Engine Runs](#7-how-the-engine-runs)
8. [Long-Term Case Protection](#8-long-term-case-protection)
9. [Integration with Workflow Engine](#9-integration-with-workflow-engine)
10. [The Broker Experience](#10-the-broker-experience)

---

## 1. Core Philosophy

### Two Sources. One System. Full Control.

```
AUTO REMINDERS (Engine-generated)          MANUAL REMINDERS (Broker-created)
───────────────────────────────           ───────────────────────────────
Created by the Reminder Engine             Created by the broker
Tied to a milestone (ETA, deadline, etc.)  Tied to whatever the broker wants
Auto-escalates as time approaches          Broker sets the schedule
Auto-resolves when milestone is met        Broker marks as done or dismisses
Broker CAN override, dismiss, or edit      Full CRUD control
```

### The Safety Principle

The auto-engine removes the burden of remembering. But the broker must never feel trapped by the automation. Every auto-generated reminder can be:

- **Dismissed** — "I know about this, I don't need reminding"
- **Snoozed** — "Remind me again in X hours/days"
- **Edited** — "Change the message or the date"
- **Deleted** — "This reminder is wrong, remove it entirely"

The auto-engine is a servant, not a master. It suggests. The broker decides.

### Why Reminders ≠ Tasks (Updated)

| | Task | Auto Reminder | Manual Reminder |
|---|------|--------------|-----------------|
| **Who creates?** | Workflow Engine | Reminder Engine | Broker |
| **What is it?** | "Do this thing" | "Time is running out" | "Don't forget X" |
| **Can broker edit?** | Yes | Yes | Yes |
| **Can broker dismiss?** | Complete or cancel | Yes (dismiss/snooze) | Yes |
| **Auto-resolves?** | No | Yes (when milestone met) | No (broker resolves) |
| **Escalates?** | No | Yes (cascade) | Yes (broker-configured) |

---

## 2. The Reminder Cascade Pattern

### The Basic Cascade Structure

```
MILESTONE DATE: 2026-08-15 (ETA for Sony speaker shipment)

TIMELINE:

7/16  ───●─── T-30: "索尼音响预计30天后到港 — 开始准备申报材料"
           │    Level: INFO · Channel: feed only
           │
7/29  ───●─── T-14: "索尼音响预计14天后到港 — 确认文件齐备"
           │    Level: INFO · Channel: feed
           │
8/05  ───●─── T-7:  "索尼音响预计7天后到港 — 准备报关单"
           │    Level: WARNING · Channel: feed + toast
           │
8/09  ───●─── T-3:  "索尼音响预计3天后到港 — 最后确认"
           │    Level: WARNING · Channel: feed + toast
           │
8/12  ───●─── T-1:  "⚠️ 索尼音响明天到港"
           │    Level: URGENT · Channel: feed + toast + notification badge
           │
8/15  ───●─── T+0:  "⚠️ 索尼音响今天到港 — 请确认申报进度"
           │    Level: URGENT · Channel: feed + toast + browser notification
           │
8/16  ───●─── T+1:  "🔴 索尼音响已到港1天 — 仍未完成申报"
           │    Level: CRITICAL · Channel: feed + toast + browser + email
           │
8/18  ───●─── T+3:  "🔴 索尼音响已到港3天 — 严重逾期"
           │    Level: CRITICAL · Channel: all channels + notify admin
           │
8/22  ───●─── T+7:  "🔴🔴 索尼音响已到港7天 — 请立即处理或说明原因"
                Level: ESCALATED · Channel: all channels + admin task
```

### Key Properties of a Cascade

1. **All reminders in a cascade share a single parent milestone.**
2. **Each reminder fires exactly once** — it's not recurring, it's a countdown chain.
3. **When the milestone resolves, all unfired reminders are cancelled, and all active reminders are auto-dismissed.**
4. **Escalation is automatic** — the broker CAN override, but the default cascade is pre-configured.

---

## 3. Milestone Types & Their Cascades

### Type 1: ETA (Estimated Time of Arrival)

```
SOURCE: Bill of Lading, shipping notification email, carrier update
EXTRACTION: Email AI → shipment.eta.date
RESOLVED WHEN: Case reaches SUBMITTED stage (declaration filed)
               OR: Actual arrival confirmed (actual_arrival set)

CASCADE:
  T-30d: INFO     "预计30天后到港 — 可以开始准备申报材料"
  T-14d: INFO     "预计14天后到港 — 确认文件已齐备"
  T-7d:  WARNING  "预计7天后到港 — 请准备报关单"
  T-3d:  WARNING  "预计3天后到港 — 最后确认申报准备"
  T-1d:  URGENT   "明天到港 — 确保申报材料完备"
  T+0:   URGENT   "今天到港 — 请确认是否已提交申报"
  T+1d:  CRITICAL "已到港1天 — 仍未提交申报"
  T+3d:  CRITICAL "已到港3天 — 严重逾期，请立即处理"
  T+7d:  ESCALATE "已到港7天 — 通知管理员"

IF ETA CHANGES (carrier update):
  → All unfired reminders recalculated based on new ETA
  → Already-fired reminders remain in history
```

### Type 2: ETD (Estimated Time of Departure)

```
SOURCE: Bill of Lading, booking confirmation
EXTRACTION: Email AI → shipment.etd.date
RESOLVED WHEN: Vessel departs (status update) OR case reaches CLEARED

CASCADE:
  T-7d:  INFO     "预计7天后开船"
  T-3d:  WARNING  "预计3天后开船 — 确认出口申报进度"
  T-1d:  URGENT   "明天开船 — 确保舱单已确认"
  T+0:   URGENT   "今天开船"
  T+1d:  CRITICAL "已开船1天 — 确认提单已签发"
```

### Type 3: Customs Query Deadline

```
SOURCE: Customs query email (查验通知, 补税通知, 询问函)
EXTRACTION: Email AI → deadlines[] → calculated deadline
RESOLVED WHEN: Case leaves QUERY_RAISED stage

CASCADE (based on calculated deadline):
  T-5d:  INFO     "海关查询回复截止 — 剩余5个工作日"
  T-3d:  WARNING  "海关查询回复截止 — 剩余3个工作日"
  T-2d:  WARNING  "海关查询回复截止 — 剩余2个工作日"
  T-1d:  URGENT   "海关查询回复截止 — 明天到期!!"
  T+0:   URGENT   "海关查询回复截止 — 今天是最后一天!!"
  T+1d:  CRITICAL "海关查询已逾期1天 — 可能导致退单"
  T+3d:  CRITICAL "海关查询已逾期3天 — 严重风险"

NOTE: If the customs email says "5个工作日内回复", the AI has already
calculated the absolute deadline. The reminder cascade uses that date.
```

### Type 4: Document Expected from Client

```
SOURCE: Client email saying "I'll send X by Friday" OR AI prediction
        based on typical document turnaround
RESOLVED WHEN: Document status becomes VERIFIED or NOT_APPLICABLE

CASCADE (based on expected_date):
  T-3d:  INFO     "原产地证预计3天后收到 — 如未收到请跟进"
  T-1d:  WARNING  "原产地证明天应收到 — 准备跟进"
  T+0:   WARNING  "原产地证今天应收到 — 请检查"
  T+1d:  URGENT   "原产地证逾期1天未收到 — 建议联系客户"
  T+3d:  CRITICAL "原产地证逾期3天 — 请跟进客户李经理"
  T+5d:  ESCALATE "原产地证逾期5天 — 案件停滞，通知管理员"

IF NO EXPECTED DATE WAS GIVEN:
  → Engine uses default: 3 working days from when client was first asked
  → Creates a single reminder at T+3d: "已请求原产地证3天 — 如未收到请跟进"
```

### Type 5: Payment Deadline

```
SOURCE: Customs duty payment notice, tax invoice
EXTRACTION: Email AI → financial data → payment due date
RESOLVED WHEN: Payment receipt document is VERIFIED

CASCADE:
  T-14d: INFO     "关税缴纳截止 — 剩余14天"
  T-7d:  INFO     "关税缴纳截止 — 剩余7天"
  T-3d:  WARNING  "关税缴纳截止 — 剩余3天"
  T-1d:  URGENT   "关税缴纳截止 — 明天到期!!"
  T+0:   URGENT   "关税缴纳截止 — 今天是最后一天"
  T+1d:  CRITICAL "关税已逾期1天 — 可能产生滞纳金"
  T+3d:  CRITICAL "关税已逾期3天"
  T+7d:  ESCALATE "关税已逾期7天 — 通知管理员"
```

### Type 6: Stage Stall Detection

```
SOURCE: Workflow Engine — case stays in same stage too long
RESOLVED WHEN: Case advances to next stage

CASCADE (based on time in current stage):
  FOR COLLECTING_DOCUMENTS:
    3d:  INFO     "案件已等待文件3天"
    5d:  WARNING  "案件已等待文件5天 — 建议跟进客户"
    7d:  URGENT   "案件已等待文件7天 — 标记为停滞"
    10d: CRITICAL "案件停滞10天"
    14d: ESCALATE "案件停滞14天 — 通知管理员"

  FOR PREPARING:
    1d:  INFO     "案件准备中 — 已1天"
    3d:  WARNING  "案件准备中已3天 — 请加快进度"
    5d:  URGENT   "案件准备中已5天 — 标记为停滞"

  FOR UNDER_REVIEW:
    3d:  INFO     "海关审核中 — 已3天 (该口岸平均3天)"
    7d:  WARNING  "海关审核中已7天 — 超出平均水平"
    14d: URGENT   "海关审核中已14天 — 建议电话咨询海关"
    30d: CRITICAL "海关审核中已30天 — 严重异常"
```

### Type 7: Permit & Certificate Expiry

```
SOURCE: Document metadata — expiry date on permits, licenses, COs
EXTRACTION: AI document extraction → expiry_date field
RESOLVED WHEN: Document is replaced/renewed, or case is COMPLETED

CASCADE (before expiry):
  T-90d: INFO     "进口许可证将于90天后到期"
  T-60d: INFO     "进口许可证将于60天后到期"
  T-30d: WARNING  "进口许可证将于30天后到期 — 建议开始续期"
  T-14d: WARNING  "进口许可证将于14天后到期"
  T-7d:  URGENT   "进口许可证将于7天后到期 — 请立即续期"
  T-3d:  URGENT   "进口许可证将于3天后到期!!"
  T-1d:  CRITICAL "进口许可证明天到期!!"
  T+0:   CRITICAL "进口许可证今天到期!!"
  T+1d:  ESCALATE "进口许可证已过期 — 通知管理员"

NOTE: For permits that affect active cases, the cascade is more aggressive.
For archived cases, only T-90d and T-60d are shown (FYI only).
```

### Type 8: Free Trade Agreement (FTA) Rate Expiry

```
SOURCE: Case context — country of origin + FTA status
RESOLVED WHEN: Case is COMPLETED or FTA certificate expires

This is a SPECIAL milestone. FTA preferential tariff rates can expire.
If a case relies on a CO for FTA rate and the certificate expires before clearance:

  T-30d before CO expiry: WARNING "原产地证30天后到期 — 如案件未在此前清关，将失去FTA优惠税率"
  T-14d: URGENT
  T-7d:  CRITICAL
```

---

## 4. The Escalation Strategy

### 4.1 Escalation Levels

```
LEVEL 0: SILENT
  → Reminder is generated but not shown. Logged for audit only.
  → Used for: T-30d ETA reminders (too early to bother broker)

LEVEL 1: INFO
  → Appears in the attention feed with a blue indicator.
  → No toast, no notification, no sound.
  → Broker sees it when they open Harbor.

LEVEL 2: WARNING
  → Appears in the attention feed with a yellow/orange indicator.
  → Toast notification when broker is actively using Harbor.
  → No browser notification.

LEVEL 3: URGENT
  → Appears at TOP of attention feed with a red indicator.
  → Toast notification with sound.
  → Browser notification (even if Harbor is in background tab).
  → Badge on sidebar.

LEVEL 4: CRITICAL
  → Appears at TOP of attention feed with flashing red indicator.
  → Toast + sound + browser notification.
  → If broker not logged in for 4+ hours: EMAIL notification.
  → Badge on sidebar with count.

LEVEL 5: ESCALATED
  → All CRITICAL channels.
  → Notify ADMIN (different user) via all channels.
  → Create an ESCALATION TASK assigned to admin.
  → Log as ESCALATION event.
```

### 4.2 Escalation Triggers (by Milestone Type)

| Milestone Type | INFO → WARNING | WARNING → URGENT | URGENT → CRITICAL | CRITICAL → ESCALATE |
|---------------|----------------|------------------|-------------------|---------------------|
| ETA | T-7d | T-1d | T+1d | T+7d |
| Customs Deadline | T-5d | T-1d | T+1d | T+3d |
| Document Expected | T-3d | T+1d | T+3d | T+5d |
| Payment | T-7d | T-1d | T+1d | T+7d |
| Stage Stall | 3d | 5d | 10d | 14d |
| Permit Expiry | T-30d | T-7d | T-1d | T+1d |

### 4.3 Notification Channels

```
CHANNELS (in order of intrusiveness):

1. ATTENTION FEED ITEM
   → Always on. Every active reminder appears here.
   → Ordered by: escalation level → time until/since milestone

2. TOAST NOTIFICATION
   → Fires when: broker is actively using Harbor
   → Shows for: WARNING and above
   → Auto-dismisses after 8 seconds

3. BROWSER NOTIFICATION
   → Fires when: URGENT and above
   → Shows even if Harbor tab is in background
   → Requires browser permission (one-time)

4. EMAIL NOTIFICATION
   → Fires when: CRITICAL and above + broker hasn't logged in for 4+ hours
   → Contains: case number, reminder text, link to case
   → Rate-limited: max 1 email per hour (don't spam)

5. ADMIN ESCALATION
   → Fires when: ESCALATED level
   → Creates a task assigned to admin user
   → Admin sees: "CB-0045 已逾期7天 — 张三未处理"
```

---

## 5. Auto-Resolution: When Reminders Disappear

### 5.1 The Resolution Contract

```
WHEN A MILESTONE IS RESOLVED:

1. The milestone's resolution_date is set
2. ALL reminders in the cascade are evaluated:

   UNFIRED (fire_at > now):
     → CANCELLED. Never shown to broker.
   
   FIRED AND ACTIVE (fire_at <= now, not yet acknowledged):
     → AUTO-DISMISSED. Removed from attention feed.
     → Replaced with a single "已解决" activity log entry.
   
   FIRED AND ACKNOWLEDGED (broker saw it):
     → MARKED RESOLVED. Stays in history but not in active feed.
     → Visual: strikethrough in history view.

3. The cascade itself is marked as RESOLVED.
4. No manual action from broker needed.
```

### 5.2 Resolution Triggers by Milestone Type

| Milestone Type | Resolved When | How Engine Detects |
|---------------|---------------|-------------------|
| ETA | Case reaches SUBMITTED or actual_arrival is set | Workflow engine stage change OR AI email extraction |
| ETD | Case reaches CLEARED or vessel departure confirmed | Workflow engine stage change |
| Customs Deadline | Case leaves QUERY_RAISED stage | Workflow engine stage change |
| Document Expected | Document status → VERIFIED or NOT_APPLICABLE | Document checklist update |
| Payment Deadline | Payment receipt document VERIFIED | Document checklist update |
| Stage Stall | Case advances to next stage | Workflow engine stage change |
| Permit Expiry | Document renewed (new document with later expiry) OR case COMPLETED | Document update detection |

### 5.3 Resolution vs. Dismissal vs. Snooze

```
Three different things happen to reminders:

1. RESOLVED (the milestone is met)
   → Triggered by: underlying milestone achieved (case advanced, document received, etc.)
   → Effect: ALL instances in the cascade are cancelled or dismissed
   → This is automatic. The engine detects the resolution.
   → Example: ETA cascade → case submitted → entire cascade resolved

2. DISMISSED (broker manually clears a single reminder instance)
   → Triggered by: broker clicking "✕" on a specific reminder
   → Effect: THIS instance is removed from feed. Goes to history.
   → The cascade continues — next instance will still fire.
   → The underlying milestone is NOT affected.
   → Example: Broker sees T-14 ETA reminder, dismisses it.
     T-7 and T-1 reminders will still fire.

3. SNOOZED (broker postpones a single reminder instance)
   → Triggered by: broker clicking "⏰" and choosing a time
   → Effect: THIS instance disappears and returns at the snoozed time.
   → The cascade continues independently.
   → Example: Broker snoozes T-3 reminder to tomorrow.
     The T-1 reminder will still fire on schedule.

WHAT NEVER HAPPENS:
  ❌ Dismissing one instance does NOT silence the cascade
  ❌ Snoozing does NOT delay the milestone date
  ❌ The engine does NOT recreate a dismissed instance
  ❌ Time passing without resolution DOES escalate (doesn't disappear)
```

---

## 6. The Reminder Data Model

### 6.0 How Manual Reminders Fit In

```
Manual reminders and auto cascades share the same data model:

- AUTO CASCADE: milestone_type = one of the predefined types (ETA, CUSTOMS_DEADLINE, etc.)
                source_type = 'EMAIL_EXTRACTION' | 'WORKFLOW_ENGINE' | 'DOCUMENT_METADATA'
                cascade_config = engine-generated countdown points
                → Engine manages lifecycle

- MANUAL REMINDER: milestone_type = 'MANUAL'
                  source_type = 'BROKER_CREATED'
                  cascade_config = single instance (just one reminder, no cascade)
                  → Broker manages lifecycle
                  → Engine never modifies or resolves it
                  → Editable, dismissible, snoozable

Both types live in the same database tables, appear in the same feed,
and support the same actions (dismiss, snooze, edit).
The difference is who manages the lifecycle.
```

### 6.1 New Table: `reminder_cascades`

```sql
reminder_cascades (
    id              UUID PRIMARY KEY,
    case_id         UUID REFERENCES cases(id) NOT NULL,
    
    -- What milestone is this cascade tracking?
    milestone_type  TEXT NOT NULL,
    -- AUTO TYPES: ETA | ETD | CUSTOMS_DEADLINE | DOCUMENT_EXPECTED | 
    --             PAYMENT_DEADLINE | STAGE_STALL | PERMIT_EXPIRY | FTA_EXPIRY
    -- MANUAL:     MANUAL
    
    -- Who created this?
    source_type     TEXT NOT NULL,
    -- AUTO: EMAIL_EXTRACTION | WORKFLOW_ENGINE | DOCUMENT_METADATA
    -- MANUAL: BROKER_CREATED
    
    created_by      UUID REFERENCES users(id),  -- NULL for auto, broker_id for manual
    
    milestone_label TEXT NOT NULL,     -- "索尼音响 — 预计到港"
    milestone_date  TIMESTAMPTZ,       -- The anchor date for the cascade
    
    -- What's the source of this milestone?
    source_type     TEXT NOT NULL,     -- EMAIL_EXTRACTION | WORKFLOW_ENGINE | DOCUMENT_METADATA
    source_id       UUID,              -- email_extractions.id or workflow_stages.id etc.
    
    -- Cascade configuration
    cascade_config  JSONB NOT NULL,    -- Defines the countdown points
    -- Example:
    -- [
    --   {"offset_days": -30, "level": "INFO", "message_template": "预计{days}天后到港"},
    --   {"offset_days": -14, "level": "INFO", "message_template": "预计{days}天后到港"},
    --   ...
    -- ]
    
    -- Resolution
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,              -- 'SYSTEM' | 'MILESTONE_CHANGED' | 'CASE_ADVANCED'
    resolution_reason TEXT,            -- "Case advanced to SUBMITTED"
    
    -- If milestone date changes (e.g., ETA updated)
    previous_milestone_date TIMESTAMPTZ,  -- For audit
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cascade_case ON reminder_cascades(case_id) WHERE NOT is_resolved;
CREATE INDEX idx_cascade_milestone ON reminder_cascades(milestone_date);
```

### 6.2 New Table: `reminder_instances`

```sql
reminder_instances (
    id              UUID PRIMARY KEY,
    cascade_id      UUID REFERENCES reminder_cascades(id) NOT NULL,
    case_id         UUID REFERENCES cases(id) NOT NULL,
    
    -- When should this reminder fire?
    fire_at         TIMESTAMPTZ NOT NULL,
    
    -- What to show
    level           TEXT NOT NULL,     -- INFO | WARNING | URGENT | CRITICAL | ESCALATED
    message         TEXT NOT NULL,     -- The actual reminder text
    
    -- Status
    status          TEXT NOT NULL DEFAULT 'PENDING',
    -- PENDING     : Not yet fired (fire_at is in the future)
    -- ACTIVE      : Fired, shown in broker's feed
    -- ACKNOWLEDGED: Broker saw it (opened the case or clicked through)
    -- DISMISSED   : Auto-resolved because milestone was resolved
    -- CANCELLED   : Cascade was resolved before this instance fired
    
    -- Tracking
    fired_at        TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    
    -- Notification delivery tracking
    notification_channels JSONB,       -- Which channels were used?
    -- {"toast": true, "browser": true, "email": false}
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_instance_status ON reminder_instances(status, fire_at);
CREATE INDEX idx_instance_case ON reminder_instances(case_id, status);
CREATE INDEX idx_instance_fire ON reminder_instances(fire_at) WHERE status = 'PENDING';
```

### 6.3 Why Separate `cascades` and `instances`

```
cascades: The PARENT — defines the milestone and the countdown pattern
instances: The CHILDREN — individual reminders that fire at specific times

This separation allows:
1. One query to cancel ALL unfired instances when a milestone resolves
   UPDATE reminder_instances SET status='CANCELLED' WHERE cascade_id=X AND status='PENDING'
2. Tracking which reminders actually fired vs. were cancelled
3. Audit: "How many times was the broker reminded about this milestone?"
4. If milestone date changes, cascade is updated and unfired instances recalculated
```

---

## 7. How the Engine Runs

### 7.1 The Evaluation Cycle

```
The Reminder Engine runs on a TWO-TIER schedule:

TIER 1: Event-driven (immediate)
  → Milestone created/updated (new ETA, new customs deadline, etc.)
  → Milestone resolved (document received, case advanced, etc.)
  → Trigger: CREATE new cascade or RESOLVE existing cascade

TIER 2: Cron-based (every 5 minutes)
  → Check all PENDING instances where fire_at <= now()
  → Fire them: status → ACTIVE, push to broker's feed
  → Check all ACTIVE instances that should escalate
  → Escalate: level up, push stronger notification
```

### 7.2 Cascade Creation Logic

```
FUNCTION create_cascade_for_milestone(case, milestone_type, milestone_date, source):

    // Step 1: Determine the cascade template
    template = CASCADE_TEMPLATES[milestone_type]

    // Step 2: Check if a cascade already exists for this milestone
    existing = find_existing_cascade(case.id, milestone_type)
    IF existing AND NOT existing.is_resolved:
        // Milestone date may have changed
        IF existing.milestone_date != milestone_date:
            update_cascade(existing, milestone_date)
        RETURN  // Don't create duplicate

    // Step 3: Create the cascade
    cascade = INSERT INTO reminder_cascades (
        case_id, milestone_type, milestone_label,
        milestone_date, source_type, source_id,
        cascade_config: template
    )

    // Step 4: Generate all instances
    FOR EACH step in template:
        fire_at = milestone_date + step.offset_days
        IF fire_at > NOW():  // Only create future instances
            INSERT INTO reminder_instances (
                cascade_id, case_id,
                fire_at, level: step.level,
                message: format(step.message_template, case, milestone_date),
                status: 'PENDING'
            )

    // Step 5: Log
    log_activity(case.id, "REMINDER_CASCADE_CREATED",
        f"为{template.label}创建提醒序列 — {count_future_instances}个提醒")
```

### 7.3 Cascade Resolution Logic

```
FUNCTION resolve_cascade(cascade, reason):

    // Step 1: Cancel all unfired instances
    UPDATE reminder_instances
    SET status = 'CANCELLED', resolved_at = NOW()
    WHERE cascade_id = cascade.id AND status = 'PENDING'

    // Step 2: Dismiss all active instances
    UPDATE reminder_instances
    SET status = 'DISMISSED', resolved_at = NOW()
    WHERE cascade_id = cascade.id AND status IN ('ACTIVE', 'ACKNOWLEDGED')

    // Step 3: Mark cascade resolved
    UPDATE reminder_cascades
    SET is_resolved = TRUE, resolved_at = NOW(),
        resolved_by = 'SYSTEM', resolution_reason = reason
    WHERE id = cascade.id

    // Step 4: Push UI update
    push_sse(case_id, "reminders_resolved", {
        cascade_id: cascade.id,
        instances_cancelled: count_cancelled,
        instances_dismissed: count_dismissed
    })
```

### 7.4 The 5-Minute Cron Job

```
FUNCTION reminder_cron_job():

    // PART 1: Fire pending reminders
    pending = SELECT * FROM reminder_instances
              WHERE status = 'PENDING' AND fire_at <= NOW()
              ORDER BY fire_at ASC
    
    FOR EACH instance in pending:
        instance.status = 'ACTIVE'
        instance.fired_at = NOW()
        push_to_attention_feed(instance)
        
        IF instance.level IN ('URGENT', 'CRITICAL', 'ESCALATED'):
            send_toast_notification(instance)
        
        IF instance.level IN ('CRITICAL', 'ESCALATED'):
            send_browser_notification(instance)
        
        IF instance.level == 'ESCALATED':
            check_and_send_email(instance)
            escalate_to_admin(instance)

    // PART 2: Check for escalations
    // Active reminders that have been sitting unacknowledged
    active = SELECT * FROM reminder_instances
             WHERE status = 'ACTIVE'
             AND fired_at < NOW() - INTERVAL '4 hours'
    
    FOR EACH instance in active:
        IF should_escalate(instance):
            instance.level = next_level(instance.level)
            instance.message = escalate_message(instance)
            push_to_attention_feed(instance)  // Update with new level

    // PART 3: Check for missed milestones
    // Cascades where milestone_date has passed but cascade is unresolved
    missed = SELECT * FROM reminder_cascades
             WHERE NOT is_resolved
             AND milestone_date < NOW() - INTERVAL '1 day'
             AND NOT has_active_instances()
    
    FOR EACH cascade in missed:
        // Create a late instance
        INSERT INTO reminder_instances (
            cascade_id, case_id, fire_at: NOW(),
            level: 'CRITICAL',
            message: generate_late_message(cascade),
            status: 'ACTIVE'
        )
```

---

## 8. Long-Term Case Protection

### The Problem

Cases can last months. A broker can easily forget about a case that's been in UNDER_REVIEW for 3 weeks. The reminder engine is the system's memory — it doesn't forget.

### 8.1 The "Never Forget" Architecture

```
FOR EVERY ACTIVE CASE, AT ALL TIMES:

1. There is at least ONE active reminder cascade.
   If a case has zero active cascades → the engine creates a
   "GENERAL_CHECKUP" reminder for 7 days from now.

2. The broker's dashboard ALWAYS shows the next upcoming milestone
   for every case, even if it's weeks away.

3. Cases are sorted by "time until next critical event" — 
   the case with the closest deadline is always at the top.
```

### 8.2 Multi-Case Overview

```
The dashboard shows a timeline view of ALL upcoming milestones:

┌────────────────────────────────────────────────────────────────┐
│  📅 即将到来的里程碑                                             │
│                                                                │
│  今天                                                          │
│  🔴 CB-0045 海关查询截止 (今天!!!)                               │
│  🟡 CB-0038 预计到港                                             │
│                                                                │
│  明天                                                          │
│  🟡 CB-0041 原产地证预计收到                                     │
│                                                                │
│  3天内                                                         │
│  🔵 CB-0048 预计30天后到港 (T-30提醒)                            │
│  🔵 CB-0050 关税截止剩余14天                                     │
│                                                                │
│  7天内                                                         │
│  🔵 CB-0039 海关审核已7天 (超出平均)                             │
│  🔵 CB-0052 准备阶段已3天                                        │
│                                                                │
│  30天内                                                        │
│  ○ CB-0042 许可证90天后到期                                      │
│  ○ CB-0047 预计到港 (T-30)                                      │
└────────────────────────────────────────────────────────────────┘
```

### 8.3 The "Nothing Falling Through Cracks" Guarantee

```
WEEKLY HEALTH CHECK (runs every Monday at 8:00 AM):

For every case that is NOT in COMPLETED or CANCELLED status:

1. Does the case have at least one active reminder cascade?
   → If no: create GENERAL_CHECKUP cascade (7-day check-in)

2. Is the case in a stage longer than the typical duration?
   → If yes: create STAGE_STALL cascade

3. Are there documents that were EXPECTED but never received?
   → If yes: create DOCUMENT_EXPECTED cascade with MISSING status

4. Has the case had ANY activity in the last 14 days?
   → If no: create reminder: "案件{case_no}已14天无活动 — 请确认是否需要跟进"

5. Generate a WEEKLY SUMMARY for the broker:
   "本周: 3个案件即将到期, 2个案件停滞, 1个案件需要跟进"
```

---

## 9. Integration with Workflow Engine

### The Two Engines Work Together

```
WORKFLOW ENGINE                      REMINDER ENGINE
────────────────                     ────────────────

Case enters COLLECTING_DOCUMENTS     → Creates ETA cascade (if ETA exists)
                                     → Creates DOCUMENT_EXPECTED cascades
                                        for each expected document

Case enters PREPARING                → Resolves ETA cascade
                                     → Creates PREPARATION_STALL cascade

Case enters READY_TO_SUBMIT          → Resolves DOCUMENT_EXPECTED cascades
                                     (all docs are in)
                                     → Resolves PREPARATION_STALL cascade

Broker submits case                  → Creates UNDER_REVIEW cascade
(SUBMITTED)                            (track how long customs takes)

Customs query detected               → Resolves UNDER_REVIEW cascade
(QUERY_RAISED)                       → Creates CUSTOMS_DEADLINE cascade

Customs release detected             → Resolves CUSTOMS_DEADLINE cascade
(CLEARED)                            → Creates PAYMENT_DEADLINE cascade

All duties paid                      → Resolves PAYMENT_DEADLINE cascade
Case completes (COMPLETED)           → Resolves ALL remaining cascades
```

### Handshake Protocol

```
When Workflow Engine advances a case:

1. Workflow Engine calls: ReminderEngine.on_stage_change(case_id, old_stage, new_stage)
2. Reminder Engine:
   a. Resolves cascades that are no longer relevant to new_stage
   b. Creates cascades that become relevant in new_stage
   c. Recalculates STAGE_STALL cascade (reset timer for new stage)
3. Returns: list of changes made (for activity log)

When Email AI extracts a new milestone (e.g., ETA, deadline):

1. Email AI stores extraction
2. Email AI calls: ReminderEngine.on_milestone_extracted(case_id, milestone_type, date, source)
3. Reminder Engine:
   a. Checks if cascade already exists for this milestone
   b. If exists and date changed: update cascade
   c. If exists and date same: ignore
   d. If doesn't exist: create cascade
4. Returns: cascade_id (for linking)
```

---

## 10. The Broker Experience

### 10.1 The Attention Feed (Reminders Section)

```
┌──────────────────────────────────────────────────────────────────┐
│  🔔 提醒 (5)                                                      │
│                                                                  │
│  URGENT — 截止日期                                                │
│  🔴 CB-0045 索尼音响 — 海关查询回复截止                             │
│     今天是最后一天                                                │
│     [查看案件]                                                    │
│                                                                  │
│  🔴 CB-0038 深圳贸易 — 关税缴纳逾期1天                              │
│     可能产生滞纳金                                                │
│     [查看案件]                                                    │
│                                                                  │
│  WARNING — 即将到来                                               │
│  🟡 CB-0048 东芝电子 — 预计3天后到港                               │
│     申报准备是否完成？                                            │
│     [查看案件]                                                    │
│                                                                  │
│  🟡 CB-0041 三菱电机 — 原产地证逾期1天未收到                       │
│     建议联系客户                                                  │
│     [查看案件]                                                    │
│                                                                  │
│  INFO — 提前通知                                                  │
│  🔵 CB-0050 富士通 — 关税截止剩余14天                              │
│     [查看案件]                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 What the Broker ALWAYS Has Access To

```
FULL MANUAL CONTROL — every reminder, auto or manual, can be:

✅ CREATED manually
   • "➕ 创建提醒" button on: dashboard header, case page, task board
   • Quick create: type message → pick date → done (5 seconds)
   • Full create: message, date, priority, linked case, recurrence
   • Manual reminders are visually distinct from auto reminders
     (marked with ✋ icon vs 🤖 icon)

✅ DISMISSED
   • "✕" dismiss button on EVERY reminder (auto and manual)
   • Auto reminders: dismissed = broker has seen it and doesn't need
     this specific reminder. The underlying cascade continues —
     future reminders in the same cascade will still fire.
     The dismissed instance goes to history.
   • Manual reminders: dismissed = completed/resolved.
     Goes to history as "已关闭".
   • Every dismissal is logged: who, when, which reminder

✅ SNOOZED
   • "⏰" snooze button on EVERY reminder
   • Options: 1 hour / 3 hours / tomorrow morning / next week / custom date
   • Snoozed reminders leave the feed and return at the chosen time
   • Show "↩ 已推迟至 7月22日 09:00" on the reminder when it returns
   • Can be snoozed repeatedly
   • Snooze history is tracked

✅ EDITED
   • Click on any reminder message → inline edit
   • For auto reminders: editing the message or date converts it to
     a "custom" reminder that won't be reset by the engine.
     Shows warning: "⚠️ 此提醒已从自动提醒转为手动提醒"
   • For manual reminders: edit freely

✅ CONFIGURED (Settings page)
   • Per milestone type: choose cascade density
     → Conservative: fewer reminders (T-7, T-1, T+0 only)
     → Standard: default cascades as designed
     → Aggressive: more reminders, earlier warnings
   • Notification channels: toggle toast / browser / email per level
   • Quiet hours: suppress non-urgent notifications during chosen window
     (default: 22:00-08:00, URGENT and above still come through)
   • Default snooze duration preference
   • Per-broker preferences (each broker can set their own)

✅ VIEWED IN HISTORY
   • "📜 提醒历史" tab on case page
   • Shows ALL reminders — active, dismissed, snoozed, auto-resolved, cancelled
   • Filter by: status, source (auto/manual), date range
   • Each entry shows: message, when it fired, what happened to it
   • Auto-resolved reminders are shown with ✅ and reason:
     "✅ 已自动解决 — 案件已提交"
```

### 10.3 How Auto and Manual Coexist

```
ATTENTION FEED — shows both auto and manual reminders, sorted by urgency:

  URGENT
  🔴 [AUTO] CB-0045 海关查询回复截止 — 今天到期
     [查看案件] [✕ 关闭] [⏰ 推迟]

  🔴 [MANUAL] 打电话给王经理确认许可证
     [✕ 完成] [⏰ 推迟] [✎ 编辑]

  WARNING
  🟡 [AUTO] CB-0048 预计3天后到港 — 确认申报准备
     [查看案件] [✕ 关闭] [⏰ 推迟]

  🟡 [MANUAL] 周五前整理7月报表
     [✕ 完成] [⏰ 推迟] [✎ 编辑]

  INFO
  🔵 [AUTO] CB-0050 关税截止剩余14天
     [查看案件] [✕ 关闭] [⏰ 推迟]

  RESOLVED (collapsed by default — click to expand)
  ✅ [AUTO] CB-0038 许可证到期提醒 — 已续期 (自动解决)
  ✅ [MANUAL] 确认三菱提单数据 — 已完成 (7/20 张三)
```

### 10.4 Safety Guarantees

```
1. AUTO REMINDERS CANNOT BE SILENTLY SUPPRESSED
   If a broker dismisses an auto reminder, only THAT instance is dismissed.
   The next instance in the cascade (e.g., T-3 → T-1) will still fire.
   The cascade itself cannot be "muted" without explicitly disabling it
   on the case page (requires confirmation).

2. DISMISSAL ≠ DELETION
   Dismissed reminders go to history, not to the void.
   Audit: "Who dismissed the T-1 ETA reminder for CB-0045?"
   Answer: always traceable.

3. ESCALATION SURVIVES DISMISSAL
   If a broker dismisses a WARNING-level reminder, the escalation to
   URGENT will still happen at the next cascade point.
   The system ensures critical deadlines are never missed.

4. MANUAL REMINDERS ARE NEVER AUTO-TOUCHED
   The engine never modifies, resolves, or cancels a broker-created reminder.
   Only the broker who created it (or an admin) can modify it.

5. OVERRIDE AUDIT TRAIL
   Every dismiss, snooze, edit, or manual create is logged with:
   { user, action, timestamp, reminder_id, previous_state, new_state }
```

---

## Summary: What the Reminder Engine Delivers

| Before (Manual) | After (Reminder Engine) |
|----------------|----------------------|
| Broker creates reminders manually | Engine auto-creates cascades. Broker can ALSO create, edit, dismiss, snooze any reminder |
| Broker guesses when to be reminded | Engine creates cascades from milestones |
| Single reminder per event | Multi-stage countdown cascade (T-30 → T+7) |
| Reminders don't escalate | Automatic escalation: INFO → WARNING → URGENT → CRITICAL → ADMIN |
| Broker dismisses reminders manually | Auto-resolved when milestone is met. Broker can also dismiss or snooze anytime |
| Forgotten long-term cases | Weekly health check catches every case |
| No visibility into upcoming deadlines | Timeline view of all upcoming milestones |
| Reminders are a separate feature | Reminders are integrated with Workflow + Email AI |
| "Did I forget something?" anxiety | "Nothing falls through cracks" guarantee |
