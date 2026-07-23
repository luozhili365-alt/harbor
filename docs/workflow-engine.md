# Workflow Engine — Complete Design

**Status:** Design Document
**Principle:** The workflow engine is the central nervous system. It knows exactly where every case is, what it needs next, and what's blocking it. The broker watches. The engine moves.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [The Lifecycle: Complete Stage Map](#2-the-lifecycle)
3. [Document-Driven Progression](#3-document-driven-progression)
4. [Stage Definitions: Entry, Exit, Blockers](#4-stage-definitions)
5. [The Workflow Engine: How It Runs](#5-the-workflow-engine)
6. [Auto-Progression Triggers](#6-auto-progression-triggers)
7. [Manual Intervention: When & How](#7-manual-intervention)
8. [The Workflow Data Model](#8-the-workflow-data-model)
9. [Visual Representation in UI](#9-visual-representation)
10. [Integration with Email Intelligence Engine](#10-integration-with-email-intelligence-engine)
11. [Edge Cases & Conflict Resolution](#11-edge-cases)

---

## 1. Core Philosophy

### The Engine, Not the Broker, Moves Cases

```
Traditional software:  Broker looks at case → decides what to do → manually changes status
Harbor Workflow Engine: Event occurs (email, document, deadline) → Engine evaluates → Engine advances case → Broker is notified
```

The broker's role shifts from **operator** to **supervisor**. They intervene only when:
- The engine encounters a situation it cannot resolve (low confidence)
- A legal decision point requires human judgment (e.g., submitting to customs)
- The broker disagrees with the engine's assessment (manual override)

### Every Stage Answers Three Questions

For every case at every moment, the engine can answer:

1. **"Where are we?"** — Current stage, how long we've been here
2. **"What's missing?"** — Blockers preventing the next stage
3. **"What's next?"** — Next stage, expected timeline

The dashboard doesn't show "23 active cases." It shows "3 cases blocked waiting for documents. 5 cases under customs review. 1 case with an approaching deadline."

---

## 2. The Lifecycle: Complete Stage Map

```
                              ┌─────────────────────────────────────────┐
                              │           CASE LIFECYCLE                 │
                              └─────────────────────────────────────────┘

    ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │          │     │              │     │              │     │              │
    │   NEW    │────▶│  COLLECTING  │────▶│  PREPARING   │────▶│  READY_TO_   │
    │          │     │  _DOCUMENTS  │     │              │     │  SUBMIT      │
    │          │     │              │     │              │     │              │
    └──────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
         │                  │                    │                     │
         │            ┌─────┴─────┐              │                     │
         │            ▼           ▼              │                     │
         │     ┌──────────┐ ┌──────────┐         │              Broker MUST
         │     │ STALLED  │ │ CANCELLED│         │              click "Submit"
         │     │ (blocked)│ │          │         │              (legal decision)
         │     └──────────┘ └──────────┘         │                     │
         │                                       │                     │
         │    ┌──────────────────────────────────┴─────────────────────┘
         │    │
         │    ▼
         │  ┌──────────────┐
         │  │              │
         │  │  SUBMITTED   │
         │  │              │
         │  └──────┬───────┘
         │         │
         │    ┌────┴────────────────────┐
         │    ▼                         ▼
         │  ┌──────────────┐    ┌──────────────┐
         │  │              │    │              │
         │  │    UNDER     │    │   INSPECTION │◀──┐
         │  │    REVIEW    │    │   (查验)      │   │
         │  │              │    │              │   │
         │  └──────┬───────┘    └──────┬───────┘   │
         │         │                   │           │
         │         │            ┌──────┘           │
         │         ▼            ▼                  │
         │  ┌──────────────┐    ┌──────────────┐   │
         │  │              │    │              │   │
         │  │    QUERY     │    │   CLEARED    │   │
         │  │    RAISED    │───▶│   (已放行)    │   │
         │  │   (海关查询)  │    │              │   │
         │  │              │    └──────┬───────┘   │
         │  └──────────────┘           │           │
         │         │                   │           │
         │         │    Broker replies │           │
         │         │    to customs     │           │
         │         └───────────────────┘           │
         │                                         │
         │    ┌────────────────────────────────────┘
         │    ▼
         │  ┌──────────────┐
         │  │              │
         └─▶│  COMPLETED   │
            │  (已结关)     │
            │              │
            └──────────────┘

    ┌──────────────┐     ┌──────────────┐
    │              │     │              │
    │   REJECTED   │     │  CANCELLED   │
    │   (退单)      │     │  (已取消)     │
    │              │     │              │
    └──────┬───────┘     └──────────────┘
           │                    ▲
           │                    │
           └────────────────────┘
           Can restart from NEW  Can cancel from almost any stage
           with corrections
```

### Stage Summary

| # | Stage | Chinese | Auto or Manual | Typical Duration |
|---|-------|---------|----------------|------------------|
| 0 | `NEW` | 新建 | Auto (from email) | Minutes |
| 1 | `COLLECTING_DOCUMENTS` | 收集中 | Auto-progresses | Hours to days |
| 2 | `PREPARING` | 准备中 | Auto when docs complete | Hours |
| 3 | `READY_TO_SUBMIT` | 待提交 | **Manual gate** | Broker's discretion |
| 4 | `SUBMITTED` | 已提交 | **Manual gate** | Minutes |
| 5a | `UNDER_REVIEW` | 审核中 | Auto (customs response) | Days to weeks |
| 5b | `INSPECTION` | 查验中 | Auto (inspection notice) | Days to weeks |
| 6 | `QUERY_RAISED` | 海关查询 | Auto (query detected) | Hours to days |
| 7 | `CLEARED` | 已放行 | Auto (release notice) | — |
| 8 | `COMPLETED` | 已结关 | Auto (all tasks done + 3 days) | — |
| — | `STALLED` | 卡住 | Auto (missing docs > 5 days) | Until resolved |
| — | `REJECTED` | 已退单 | Auto (rejection notice) | — |
| — | `CANCELLED` | 已取消 | Manual | — |

---

## 3. Document-Driven Progression

### The Document Dependency Tree

Not all documents are equal. Some block the entire case. Some only block specific stages.

```
CASE TYPE: IMPORT (进口一般贸易)

Required Documents:
│
├── TIER 1: Core Identity (needed to START the case)
│   ├── Commercial Invoice (发票)          — REQUIRED, blocks PREPARING
│   └── Packing List (装箱单)              — REQUIRED, blocks PREPARING
│
├── TIER 2: Shipping (needed to PREPARE declaration)
│   └── Bill of Lading (提单)             — REQUIRED, blocks PREPARING
│
├── TIER 3: Compliance (needed to SUBMIT)
│   ├── Certificate of Origin (原产地证)   — CONDITIONAL (FTA claims only)
│   ├── Import Permit (进口许可证)         — CONDITIONAL (restricted goods)
│   ├── CIQ Certificate (检验检疫证)       — CONDITIONAL (regulated products)
│   └── MSDS (化学品安全说明书)             — CONDITIONAL (chemical products)
│
└── TIER 4: Financial (needed to COMPLETE)
    ├── Duty Payment Receipt (关税缴款书)   — REQUIRED, blocks COMPLETED
    └── VAT Payment Receipt (增值税缴款书)  — REQUIRED, blocks COMPLETED
```

### How the Engine Knows What's Required

The document checklist is **dynamic** — not a static template. It's computed from:

```
CHECKLIST = f(
    case.type,              // IMPORT or EXPORT
    HS_CODES,               // from case items → determines regulatory conditions
    case.country_of_origin, // FTA eligibility
    case.supervision_mode,  // 一般贸易 vs 加工贸易 etc.
    case.transport_mode     // different docs for sea vs air
)

Example:
HS 8518.2900.00 (speaker parts) + Japan origin + 一般贸易 + 海运
→ REQUIRED: Invoice, Packing List, B/L
→ CONDITIONAL: Certificate of Origin (中日FTA), Import Permit (not needed for this HS)
```

### Document Status Tracking

Each required document has one of these states:

```
NOT_MENTIONED   — Nobody has mentioned this document yet
EXPECTED        — Client said they'll send it, but haven't yet
RECEIVED        — Document received, awaiting AI verification
VERIFIED        — AI extracted data, broker confirmed (or AI confidence ≥ 95%)
MISSING         — Was expected by a deadline but not received (overdue)
NOT_APPLICABLE  — This document is not required for this case (e.g., no permit needed)
```

This is tracked in a new table (see Section 8), not as a free-text field on the case.

---

## 4. Stage Definitions: Entry, Exit, Blockers

### STAGE 0: `NEW`

```
ENTRY TRIGGER:
  → AI creates case from email (auto)
  → Broker creates case manually (rare)

WHILE IN THIS STAGE:
  → System is waiting for the first document
  → Case has minimal data (client, type, maybe B/L from email subject)

EXIT CONDITIONS (ANY of):
  → First document attached (invoice, PL, or B/L) → advance to COLLECTING_DOCUMENTS
  → 24 hours with no activity → advance to COLLECTING_DOCUMENTS anyway

BLOCKERS:
  → None (this is the starting stage)

MAX DURATION BEFORE ALERT:
  → 24 hours (if still NEW, the case may be a false creation)
```

### STAGE 1: `COLLECTING_DOCUMENTS`

```
ENTRY TRIGGER:
  → First document received (auto)
  → Case advanced from NEW

WHILE IN THIS STAGE:
  → System tracks which documents are received vs. expected
  → AI processes each document as it arrives
  → System identifies missing documents from the checklist

EXIT CONDITIONS (ALL must be true):
  → All TIER 1 documents RECEIVED + VERIFIED
  → All TIER 2 documents RECEIVED + VERIFIED
  → All TIER 3 CONDITIONAL documents either RECEIVED or confirmed NOT_APPLICABLE
  → AI has extracted line items from invoice
  → AI has suggested HS codes for all line items

BLOCKERS:
  → [DOCUMENT_MISSING] Any required document not yet received
  → [EXTRACTION_FAILED] AI could not extract data from a received document
  → [VERIFICATION_NEEDED] Broker hasn't verified AI extraction (confidence < 95%)

SUB-STAGES (visible to broker):
  ├── ✓ Invoice received and verified
  ├── ✓ Packing List received and verified  
  ├── ⏳ Bill of Lading — expected, not yet received
  ├── ⚠ Certificate of Origin — client mentioned, deadline 7/25
  └── ✓ Import Permit — confirmed not required

MAX DURATION BEFORE ALERT:
  → 3 days without new document → creates task: "跟进客户索要缺失文件"
  → 5 days → escalates to STALLED with urgent notification
```

### STAGE 2: `PREPARING`

```
ENTRY TRIGGER:
  → All required documents collected and verified (auto)

WHILE IN THIS STAGE:
  → Broker (or AI) fills in declaration data
  → HS codes finalized
  → 申报要素 (declaration elements) completed
  → Duty/tax estimates calculated
  → Guardian pre-submission checks run

EXIT CONDITIONS (ALL must be true):
  → All case items have HS codes assigned (confidence ≥ 85% or broker-confirmed)
  → All case items have 申报要素 filled
  → Declared value consistent with invoice (±5%)
  → All CONDITIONAL document requirements resolved
  → Guardian check passes with no blocking issues

BLOCKERS:
  → [HS_CODE_LOW_CONFIDENCE] Any HS code with confidence < 70%
  → [INCOMPLETE_ELEMENTS] 申报要素 not filled for any item
  → [VALUE_MISMATCH] Invoice total ≠ sum of line items by > 5%
  → [MISSING_PERMIT] HS code requires permit but none received or confirmed
  → [EXPIRED_DOCUMENT] Any document will expire before estimated clearance date

SYSTEM ACTIONS AT THIS STAGE:
  → Run Guardian check
  → Generate 报关单 preview (what will be submitted)
  → Highlight issues that need broker attention
```

### STAGE 3: `READY_TO_SUBMIT` ⚡ MANUAL GATE

```
ENTRY TRIGGER:
  → All PREPARING exit conditions met (auto)

** THIS IS A MANUAL GATE — THE BROKER MUST CLICK "SUBMIT" **

WHY MANUAL:
  → Legal responsibility: the broker certifies the declaration is correct
  → Customs penalties for errors fall on the broker, not the software
  → The system CANNOT submit on behalf of the broker

WHAT THE BROKER SEES:
  ┌─────────────────────────────────────────────┐
  │  ✅ 申报准备完成 — 可以提交                    │
  │                                              │
  │  Guardian 检查通过:                           │
  │  ✅ 文件齐全 (5/5)                           │
  │  ✅ HS编码已确认 (8项)                       │
  │  ✅ 申报要素完整                              │
  │  ✅ 金额核对一致                              │
  │  ⚠️ 原产地证8月15日到期 — 不影响本次申报      │
  │                                              │
  │  预估关税: ¥58,300                           │
  │  预估增值税: ¥94,500                         │
  │                                              │
  │  [提交申报]  [继续编辑]                       │
  └─────────────────────────────────────────────┘

BROKER ACTIONS:
  → [提交申报] → advances to SUBMITTED
  → [继续编辑] → returns to PREPARING

EXIT:
  → Broker clicks "提交申报" → advance to SUBMITTED
```

### STAGE 4: `SUBMITTED`

```
ENTRY TRIGGER:
  → Broker manually confirms submission (manual gate)

WHILE IN THIS STAGE:
  → System waits for customs response
  → No actions possible (declaration is in customs' hands)

WHAT THE SYSTEM MONITORS:
  → Time since submission (typical review: 1-3 working days)
  → Incoming emails for customs response

EXIT CONDITIONS (ANY of):
  → Customs acknowledgment received → advance to UNDER_REVIEW
  → Customs query email detected → advance to QUERY_RAISED
  → Customs inspection notice detected → advance to INSPECTION
  → Customs release notice detected → advance to CLEARED (rare: direct release)
  → 5 working days with no response → create task: "跟进海关审核进度"

BLOCKERS:
  → None actionable (waiting on customs)
```

### STAGE 5a: `UNDER_REVIEW`

```
ENTRY TRIGGER:
  → Customs acknowledgment or status update detected (auto)

WHILE IN THIS STAGE:
  → System monitors for customs communications
  → Tracks review duration against typical timelines

EXIT CONDITIONS (ANY of):
  → Customs query email → QUERY_RAISED
  → Customs inspection notice → INSPECTION
  → Customs release notice → CLEARED
  → Customs rejection notice → REJECTED

WHAT THE SYSTEM DOES:
  → Daily: check if review duration exceeds typical for this port + HS code
  → If review taking unusually long: create task with suggestion
    "深圳海关8518类商品平均审核3天，本案已审核7天。建议电话咨询海关。"
```

### STAGE 5b: `INSPECTION`

```
ENTRY TRIGGER:
  → Customs inspection notice detected (auto)

WHILE IN THIS STAGE:
  → System tracks inspection status
  → Monitors for inspection result

SYSTEM ACTIONS:
  → Create task: "准备查验 — 协调货代安排查验时间"
  → Extract inspection date from notice
  → Create task with deadline for inspection outcome

EXIT CONDITIONS (ANY of):
  → Inspection passed → CLEARED or back to UNDER_REVIEW
  → Inspection found issues → QUERY_RAISED
```

### STAGE 6: `QUERY_RAISED`

```
ENTRY TRIGGER:
  → Customs query email detected (auto)

WHILE IN THIS STAGE:
  → System tracks the query and deadline
  → Broker prepares response

SYSTEM ACTIONS:
  → Create URGENT task: "回复海关查询 — {deadline}"
  → Extract what customs is asking for
  → Highlight relevant documents in the case

EXIT CONDITIONS:
  → Broker indicates query has been responded to → back to UNDER_REVIEW
  → OR: broker manually advances (system can't detect outbound replies)

MAX DURATION BEFORE ALERT:
  → Based on customs deadline in the query
  → 1 day before deadline: escalate to URGENT notification
  → Deadline passed: mark as OVERDUE with red alert
```

### STAGE 7: `CLEARED`

```
ENTRY TRIGGER:
  → Customs release notice (放行通知) detected (auto)

WHILE IN THIS STAGE:
  → System tracks post-clearance tasks
  → Duty payment verification
  → Document archiving
  → Client notification

SYSTEM ACTIONS:
  → Create task: "通知客户已放行"
  → Create task: "归档报关单和放行证明"
  → If duties not yet paid: create PAYMENT task with deadline
  → Log: "CASE_CLEARED" activity

EXIT CONDITIONS (ALL must be true):
  → All duties paid (receipts verified)
  → All payment tasks completed
  → 3 days elapsed since clearance (cooling-off period)

MAX DURATION:
  → 7 days → auto-advance to COMPLETED anyway (don't stall on minor items)
```

### STAGE 8: `COMPLETED`

```
ENTRY TRIGGER:
  → All post-clearance conditions met (auto)

FINAL STATE:
  → Case is archived
  → All documents permanently stored
  → Case searchable but not editable
  → Retention timer starts (7 years)

SYSTEM ACTIONS:
  → Generate case summary
  → Log: "CASE_COMPLETED"
  → Remove from active dashboard
  → Archive to completed cases view
```

### STAGE —: `STALLED`

```
ENTRY TRIGGER (ANY of):
  → COLLECTING_DOCUMENTS: no new document for 5+ days
  → PREPARING: HS code unresolved for 3+ days
  → Any stage: a required action is overdue by 48+ hours

NOT A REAL STAGE:
  → STALLED is an overlay on the current stage
  → The case remains in its actual stage
  → STALLED flag appears as a red indicator

WHAT THE SYSTEM DOES:
  → Escalate notification: "⚠️ CB-0045 已停滞5天 — 缺少原产地证"
  → Create escalation task assigned to admin
  → After 10 days stalled: daily reminder

RECOVERY:
  → Blocking condition is resolved → STALLED flag removed automatically
  → Broker can manually clear STALLED flag if they disagree
```

---

## 5. The Workflow Engine: How It Runs

### 5.1 The Evaluation Cycle

```
The Workflow Engine runs as a background process.
It does NOT run on a fixed cron schedule.
It IS event-driven.

TRIGGERS:
  ├── Email ingested and processed by AI
  ├── Document uploaded or received via email
  ├── Document AI extraction completed
  ├── Broker manually changes something on a case
  ├── Deadline reached or passed
  └── Broker manually requests "check this case"

WHEN TRIGGERED:
  1. Engine loads the case + all related data
  2. Engine evaluates: "What stage SHOULD this case be in?"
  3. Engine evaluates: "Can this case advance?"
  4. If yes: advance and log
  5. If no: identify blockers and update UI
  6. Engine updates task list (create/complete tasks as needed)
```

### 5.2 The Evaluation Algorithm

```
FUNCTION evaluate_case(case_id):

    case = load_case_with_all_data(case_id)
    current_stage = case.stage

    // Step 1: Determine the TARGET stage
    target_stage = determine_target_stage(case)

    // Step 2: If already in target, check for advancement
    IF current_stage == target_stage:
        can_advance, blockers = check_advancement(case, current_stage)
        IF can_advance AND next_stage_exists(current_stage):
            advance_to(case, next_stage(current_stage))
            evaluate_case(case_id)  // recursive: keep advancing if possible
        ELSE:
            update_blockers(case, blockers)
    ELSE:
        // Stage mismatch — auto-correct
        advance_to(case, target_stage)
        evaluate_case(case_id)


FUNCTION determine_target_stage(case):

    // Work backwards from COMPLETED to find where we actually are

    IF case.cleared:
        IF all_duties_paid AND cooling_period_elapsed:
            RETURN COMPLETED
        ELSE:
            RETURN CLEARED

    IF case.has_query_from_customs:
        RETURN QUERY_RAISED

    IF case.has_inspection_notice:
        RETURN INSPECTION

    IF case.submitted_to_customs:
        IF customs_acknowledged:
            RETURN UNDER_REVIEW
        ELSE:
            RETURN SUBMITTED

    IF all_preparation_complete(case):
        RETURN READY_TO_SUBMIT

    IF all_documents_collected_and_verified(case):
        RETURN PREPARING

    IF any_document_received(case) OR case.age > 24_hours:
        RETURN COLLECTING_DOCUMENTS

    RETURN NEW


FUNCTION check_advancement(case, stage):

    SWITCH stage:
        CASE NEW:
            IF any_document_received OR case.age > 24_hours:
                RETURN (true, [])
            RETURN (false, ["等待第一批文件"])

        CASE COLLECTING_DOCUMENTS:
            blockers = []
            FOR EACH required_doc in get_required_documents(case):
                IF doc.status != VERIFIED AND doc.status != NOT_APPLICABLE:
                    blockers.append("缺少: " + doc.type)
            IF blockers is empty:
                RETURN (true, [])
            RETURN (false, blockers)

        CASE PREPARING:
            blockers = []
            FOR EACH item in case.items:
                IF item.hs_code is None OR item.hs_code_confidence < 0.70:
                    blockers.append(item.product_name + ": HS编码未确认")
                IF item.declaration_elements is None:
                    blockers.append(item.product_name + ": 申报要素未填写")
            IF value_discrepancy(case) > 5%:
                blockers.append("申报金额与发票不一致")
            IF blockers is empty:
                RETURN (true, [])
            RETURN (false, blockers)

        CASE READY_TO_SUBMIT:
            RETURN (false, ["需要经纪人手动确认提交"])  // MANUAL GATE

        CASE SUBMITTED:
            // Can't auto-advance — waiting for customs
            RETURN (false, ["等待海关回复"])

        CASE UNDER_REVIEW:
            // Can't auto-advance — waiting for customs
            RETURN (false, ["海关审核中"])

        CASE QUERY_RAISED:
            // Can auto-advance when broker responds
            IF broker_has_responded:
                RETURN (true, [])
            RETURN (false, ["等待回复海关查询 — 截止: " + deadline])

        CASE INSPECTION:
            RETURN (false, ["海关查验中"])

        CASE CLEARED:
            blockers = []
            IF NOT all_duties_paid:
                blockers.append("关税未缴清")
            IF NOT cooling_period_elapsed:
                blockers.append("放行后观察期未结束")
            IF blockers is empty:
                RETURN (true, [])
            RETURN (false, blockers)

        CASE COMPLETED:
            RETURN (false, [])  // Terminal state

    RETURN (false, [])
```

---

## 6. Auto-Progression Triggers

### Complete Map of Auto-Triggers

| Trigger Event | Source | What Happens |
|--------------|--------|--------------|
| **First document attached to case** | Email attachment / manual upload | NEW → COLLECTING_DOCUMENTS |
| **Document AI verification complete** (confidence ≥ 95%) | AI document extraction | Mark doc as VERIFIED → re-evaluate case |
| **All Tier 1 + Tier 2 docs VERIFIED** | Multiple document events | COLLECTING_DOCUMENTS → PREPARING |
| **All line items have HS codes** (confidence ≥ 85%) | AI HS code suggestion | Mark preparation item complete → re-evaluate |
| **All 申报要素 filled** | Broker or AI fills elements | Mark preparation item complete → re-evaluate |
| **Guardian check passes** | System validation | PREPARING → READY_TO_SUBMIT |
| **Broker clicks "提交申报"** | Manual action | READY_TO_SUBMIT → SUBMITTED (MANUAL GATE) |
| **Customs acknowledgment email** | AI email classification | SUBMITTED → UNDER_REVIEW |
| **Customs query email** | AI email classification | Any post-submission stage → QUERY_RAISED |
| **Customs inspection notice** | AI email classification | Any post-submission stage → INSPECTION |
| **Customs release notice (放行通知)** | AI email classification | UNDER_REVIEW/INSPECTION → CLEARED |
| **Customs rejection notice (退单通知)** | AI email classification | Any post-submission stage → REJECTED |
| **All duties paid + 3 days elapsed** | Payment tracking + timer | CLEARED → COMPLETED |
| **No new document for 5 days** | Timer | Current stage + STALLED overlay |
| **Required doc deadline passed** | Deadline engine | Escalate notification, mark doc as MISSING |

### What NEVER Triggers Auto-Progression

```
These events do NOT cause auto-advancement:

❌ Time alone (except NEW → COLLECTING_DOCUMENTS after 24h and COMPLETED cooling-off)
❌ Broker viewing the case
❌ Someone mentioning the case in an email without sending documents
❌ AI "guessing" that customs probably approved (must detect actual notice)
❌ A document being uploaded but not yet AI-verified
```

---

## 7. Manual Intervention: When & How

### The Only Manual Actions Allowed

```
1. SUBMITTING TO CUSTOMS (READY_TO_SUBMIT → SUBMITTED)
   → Legal requirement. Must be human.

2. CANCELLING A CASE (any stage → CANCELLED)
   → Business decision. Client cancels order, etc.

3. OVERRIDING A STAGE (any stage → any valid stage)
   → Rare. Broker disagrees with engine.
   → Requires confirmation: "确定手动将案件从{current}移至{target}吗？"
   → Logged as MANUAL_OVERRIDE in activity log

4. CLEARING THE STALLED FLAG
   → Broker says "I know this looks stalled but it's fine"

5. RE-OPENING A COMPLETED CASE
   → Rare. Audit requirement, late customs query.
   → COMPLETED → UNDER_REVIEW (or relevant post-submission stage)
```

### Manual Override UI

```
When broker manually changes stage:

┌─────────────────────────────────────────────────────────┐
│  ⚠️ 手动变更案件状态                                      │
│                                                          │
│  当前状态: PREPARING (系统判定)                           │
│  目标状态: [选择新状态 ▼]                                 │
│                                                          │
│  原因:                                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 客户要求加急，文件后补                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ⚠️ 警告:                                                │
│  • 还有2项HS编码未确认                                   │
│  • 申报要素尚未填写                                       │
│                                                          │
│  [取消]  [确认强制变更]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 8. The Workflow Data Model

### 8.1 New Table: `workflow_stages`

```sql
workflow_stages (
    id              UUID PRIMARY KEY,
    case_id         UUID REFERENCES cases(id) NOT NULL,
    
    stage           TEXT NOT NULL,         -- Current stage code
    entered_at      TIMESTAMPTZ NOT NULL,  -- When case entered this stage
    exited_at       TIMESTAMPTZ,           -- When case left this stage (NULL = current)
    
    entered_by      TEXT NOT NULL,         -- 'SYSTEM' | user_id
    entered_reason  TEXT,                  -- e.g., "All documents collected and verified"
    
    -- What was blocking progress when we were in this stage
    blockers_at_entry JSONB,              -- Array of blocker descriptions
    
    -- Duration
    duration_seconds INTEGER,             -- Computed on exit
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_case ON workflow_stages(case_id, entered_at);
```

**Why a separate table:** A case's stage history is an audit trail. Every stage change is recorded with timestamp, trigger, and reason. This is different from the activity log — it's structured, queryable, and used by the engine to compute durations and detect stalls.

### 8.2 New Table: `document_checklist`

```sql
document_checklist (
    id              UUID PRIMARY KEY,
    case_id         UUID REFERENCES cases(id) NOT NULL,
    
    doc_type        TEXT NOT NULL,         -- INVOICE | PACKING_LIST | BILL_OF_LADING | ...
    doc_name_cn     TEXT NOT NULL,         -- "商业发票", "装箱单", etc.
    
    tier            INTEGER NOT NULL,      -- 1=Core, 2=Shipping, 3=Compliance, 4=Financial
    is_required     BOOLEAN NOT NULL,      -- Is this doc required for this specific case?
    requirement_reason TEXT,               -- e.g., "HS 8518 requires Certificate of Origin for FTA"
    
    status          TEXT NOT NULL DEFAULT 'NOT_MENTIONED',
    -- NOT_MENTIONED | EXPECTED | RECEIVED | VERIFIED | MISSING | NOT_APPLICABLE
    
    linked_document_id UUID REFERENCES documents(id),  -- The actual uploaded document
    
    expected_by_date TIMESTAMPTZ,          -- If client said "I'll send by Friday"
    deadline_date   TIMESTAMPTZ,           -- Hard deadline (e.g., from customs requirement)
    
    notes           TEXT,                  -- e.g., "Client says CO will arrive by 7/25"
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklist_case ON document_checklist(case_id);
CREATE INDEX idx_checklist_status ON document_checklist(case_id, status);
```

**Why this table exists:** The document checklist is dynamic and case-specific. It can't be a static field on the case. Each case gets its own checklist computed from its HS codes, origin, type, etc. The checklist evolves as documents arrive, are verified, or are determined not applicable.

### 8.3 New Table: `workflow_blockers`

```sql
workflow_blockers (
    id              UUID PRIMARY KEY,
    case_id         UUID REFERENCES cases(id) NOT NULL,
    
    blocker_type    TEXT NOT NULL,         -- DOCUMENT_MISSING | HS_CODE_UNCONFIRMED | 
                                          -- VALUE_MISMATCH | MISSING_PERMIT | 
                                          -- EXPIRED_DOCUMENT | MANUAL_GATE | 
                                          -- CUSTOMS_PENDING | PAYMENT_PENDING
    
    description     TEXT NOT NULL,         -- Human-readable: "缺少原产地证"
    detail          JSONB,                 -- Machine-readable details
    
    severity        TEXT NOT NULL,         -- BLOCKING | WARNING | INFO
    
    is_active       BOOLEAN DEFAULT TRUE,
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,                  -- 'SYSTEM' | user_id
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blockers_case ON workflow_blockers(case_id) WHERE is_active = TRUE;
```

**Why this table exists:** Blockers are the engine's way of explaining to the broker (and to itself) why a case can't advance. Each blocker is a specific, actionable item. When the broker asks "Why is this case stuck?", the answer is the list of active blockers — not a generic status label.

### 8.4 Integration with Existing `cases` Table

The `cases` table keeps its `status` field, but it becomes **derived** — set by the workflow engine, not by the broker:

```sql
-- The cases.status field is now ENFORCED by the workflow engine
-- The broker does NOT have permission to directly UPDATE cases.status
-- Instead, the engine evaluates and sets it

-- API change:
--   PUT /api/v1/cases/{id}/status  →  REMOVED
--   POST /api/v1/cases/{id}/advance →  "Check if case can advance and do it"
--   POST /api/v1/cases/{id}/override-stage →  Manual override (logged)
```

---

## 9. Visual Representation in UI

### 9.1 The Case Pipeline Bar

Every case page shows a visual pipeline at the top:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CB-2026-0045 索尼音响进口                                                    │
│                                                                              │
│  ●━━━━━━━━●━━━━━━━━●━━━━━━━━◐━━━━━━━━○━━━━━━━━○━━━━━━━━○━━━━━━━━○━━━━━━━━○  │
│  NEW     COLLECT  PREPARE  READY   SUBMIT  REVIEW  CLEAR   COMPLETE          │
│           DOCS             TO                                            │
│                            SUBMIT                                        │
│                                                                              │
│  ▲ Current stage: PREPARING                                                  │
│  已在此阶段: 4小时                                                            │
│                                                                              │
│  阻止进入下一阶段:                                                             │
│  ⚠️ 1项HS编码未确认 (PA-200音频放大器 — AI置信度78%)                          │
│  ⚠️ 原产地证尚未收到 (客户说7/25前发送)                                       │
│                                                                              │
│  [查看详情]  [强制推进 ▸]                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 The Document Checklist Widget

On the case page, replace the flat document list with a structured checklist:

```
┌──────────────────────────────────────────────┐
│  📋 文件清单                                  │
│                                              │
│  TIER 1: 核心文件                             │
│  ✅ 商业发票          INV-2026-0715.pdf       │
│     AI提取完成 · 置信度97%                    │
│  ✅ 装箱单             PackingList.xlsx       │
│     AI提取完成 · 置信度95%                    │
│                                              │
│  TIER 2: 运输文件                             │
│  ✅ 海运提单           BL-SZX0715.pdf         │
│     AI提取完成 · 置信度99%                    │
│                                              │
│  TIER 3: 合规文件                             │
│  ⏳ 原产地证                                  │
│     客户说7/25前发送 · 剩余4天                │
│  ✓ 进口许可证         (不需要 — HS编码无此要求)│
│                                              │
│  TIER 4: 财务文件                             │
│  ○ 关税缴款书         (放行后需要)            │
│  ○ 增值税缴款书       (放行后需要)            │
└──────────────────────────────────────────────┘
```

### 9.3 The Attention Feed (Updated)

The dashboard attention feed now shows workflow-specific items:

```
┌─────────────────────────────────────────────────────────┐
│  🔔 需要你处理 (4)                                       │
│                                                         │
│  🔴 CB-0045 索尼音响 — 停滞警告                           │
│     在 PREPARING 阶段停留超过3天                          │
│     原因: HS编码未确认, 原产地证未收到                    │
│     [查看案件]                                           │
│                                                         │
│  🟡 CB-0048 东芝电子 — 可以推进                          │
│     所有文件已收集验证，可以进入准备阶段                   │
│     [查看案件]                                           │
│                                                         │
│  🟡 CB-0041 三菱电机 — 待提交                            │
│     申报准备完成，可以提交海关                            │
│     [提交申报]  [继续编辑]                               │
│                                                         │
│  🟢 CB-0038 深圳贸易 — 已放行                            │
│     海关已放行。待缴关税。                                │
│     [查看案件]                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Integration with Email Intelligence Engine

### The Handshake Between Email AI and Workflow Engine

```
EMAIL AI ENGINE                          WORKFLOW ENGINE
────────────────                        ────────────────

1. Email arrives
2. AI processes:
   - Classifies: DOCUMENT_SUBMISSION
   - Extracts: Invoice, PL attached
   - Matches: CB-2026-0045
   - Confidence: 0.96
3. AI saves:
   - email record
   - document records
   - extraction data
                │
                ▼
         TRIGGER: case_id = CB-2026-0045
         event = "documents_received"
                │
                ▼
4.                              Engine loads CB-2026-0045
5.                              Evaluates document checklist:
                                  - Invoice: now RECEIVED
                                  - Packing List: now RECEIVED
                                  - B/L: still EXPECTED
6.                              Checks: all Tier 1+2 done?
                                  → No. B/L missing.
7.                              Case stays in COLLECTING_DOCUMENTS
8.                              Updates blocker list:
                                  - "缺少: 海运提单"
9.                              Updates UI via SSE
```

### When the Engine Auto-Advances After Email Processing

```
SCENARIO: Last missing document arrives

1. Email AI: B/L received for CB-0045, confidence 0.99
2. Engine loads CB-0045
3. Evaluates document checklist:
     Invoice: VERIFIED ✓
     Packing List: VERIFIED ✓
     Bill of Lading: now VERIFIED ✓
     Certificate of Origin: NOT_APPLICABLE ✓
4. All Tier 1+2+3 resolved → advance to PREPARING!
5. Log: "ADVANCED: COLLECTING_DOCUMENTS → PREPARING"
6. Reason: "All required documents collected and verified"
7. Creates task: "开始准备报关单 — 8项商品待确认HS编码"
8. Updates UI via SSE
9. Broker sees: "CB-0045 已进入准备阶段"
```

### When the Engine Detects a Customs Response

```
SCENARIO: Customs sends release notification

1. Email AI: 放行通知 for declaration 520020160000123456
2. AI matches declaration_number to CB-0045
3. AI classifies: CUSTOMS_RESPONSE, CLEARANCE
4. Engine loads CB-0045 (currently UNDER_REVIEW)
5. Evaluates: release notice detected → target stage = CLEARED
6. Advances: UNDER_REVIEW → CLEARED
7. Log: "ADVANCED: UNDER_REVIEW → CLEARED (customs release detected)"
8. Creates tasks:
     - "通知客户索尼 — 货物已放行"
     - "缴纳关税 ¥58,300 — 截止日期: {15 working days}"
     - "归档报关单和放行证明"
9. Pushes URGENT notification: "🎉 CB-0045 已放行!"
```

---

## 11. Edge Cases & Conflict Resolution

### Case 1: Partial Document Arrival

```
SCENARIO: Invoice arrives but is unreadable (OCR failed)

1. Document appears in checklist: Invoice — RECEIVED, OCR_FAILED
2. Blocker created: "发票OCR失败 — 需人工查看"
3. Engine does NOT count this as VERIFIED
4. Case stays in COLLECTING_DOCUMENTS
5. Broker sees: "⚠️ 发票已收到但无法自动识别 — 点击查看原文件"
6. Broker manually enters data from the invoice → marks as VERIFIED
7. Engine re-evaluates → advances if all docs now verified
```

### Case 2: Document Arrives for Wrong Case

```
SCENARIO: AI links an email to CB-0045, but the invoice inside is for CB-0046

1. AI links based on B/L match → high confidence
2. Later, broker notices: "This invoice is for a different shipment"
3. Broker unlinks document from CB-0045, links to CB-0046
4. Engine re-evaluates CB-0045:
     - Invoice: was VERIFIED, now removed → back to EXPECTED
     - Case may regress: PREPARING → COLLECTING_DOCUMENTS
5. Engine re-evaluates CB-0046:
     - Invoice: now RECEIVED → may advance
6. Log both stage regressions as MANUAL_CORRECTION
```

### Case 3: Client Sends Duplicate Documents

```
SCENARIO: Client sends the same invoice twice (forwarded again)

1. AI processes second email
2. SHA256 hash matches existing document → dedup
3. Engine loads CB-0045
4. Invoice is already VERIFIED → no change
5. No notification to broker (silent dedup)
6. Log: "DUPLICATE_DOCUMENT_IGNORED"
```

### Case 4: Customs Query Causes Stage Regression

```
SCENARIO: Case is UNDER_REVIEW, customs sends a query

1. Email AI detects CUSTOMS_QUERY
2. Engine advances: UNDER_REVIEW → QUERY_RAISED
3. This is technically a "progression" (more specific stage)
   but it may feel like a regression to the broker
4. Engine creates URGENT task with deadline
5. Notification: "⚠️ CB-0045: 海关查询 — 需补充原产地证"
```

### Case 5: Broker on Vacation — Auto-Stall Prevention

```
SCENARIO: Broker is away for a week. Cases should not stall.

1. If a case enters STALLED and assigned broker hasn't logged in for 48+ hours:
2. Engine checks for other active brokers
3. If another broker is available:
     → Create task assigned to admin: "CB-0045 停滞5天 — 张三休假中，是否需要重新分配?"
4. Admin can reassign the case
```

---

## Summary: What the Workflow Engine Delivers

| Before (Manual) | After (Workflow Engine) |
|----------------|-------------------|
| Broker decides what stage the case is in | Engine evaluates and sets the stage |
| Broker remembers what documents are missing | Engine tracks checklist, knows exactly what's missing |
| Broker manually changes status dropdown | Engine auto-advances on events |
| Broker wonders "what's blocking this case?" | Engine lists active blockers |
| Cases stall silently | Engine detects stalls and escalates |
| Broker remembers to follow up | Engine creates tasks with deadlines |
| No visibility into case pipeline | Visual pipeline with current stage and blockers |
| Stage changes are ad-hoc | Every stage change is logged with reason and trigger |
