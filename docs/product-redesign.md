# Harbor Product Redesign — Eliminating Work, Not Creating It

**Role:** Senior PM, customs brokerage domain  
**Principle:** Every click, every field, every decision the software asks the broker to make is a design failure until proven necessary.

---

## 1. The Core Insight

The current Harbor design models the broker's world faithfully:

> Cases have statuses → so we build a status dropdown  
> Emails come in → so we build an inbox  
> Documents get uploaded → so we build an upload button  

This is **mirroring**, not **solving**. The software becomes a digital filing cabinet — more organized than Excel, but still demanding the broker do all the cognitive work.

The real question is not "How do we digitize this step?" but **"Why does this step exist at all?"**

A customs broker's actual job is:

1. **Understand** what's being shipped (read documents)
2. **Classify** it correctly (HS codes, regulations)
3. **Declare** it to customs (fill forms, submit)
4. **Respond** to customs queries (provide evidence, explanations)
5. **Track** until clearance (monitor, remind, escalate)

Everything else — filing, searching, copying data between systems, remembering deadlines, checking "did the client send that document yet?" — is overhead. The software should absorb ALL overhead so the broker only does steps 1-5.

---

## 2. Workflow-by-Workflow Audit

### 2.1 Case Creation — ELIMINATE THE FORM

**Current design:**
```
Broker sees email → Opens Harbor → Clicks "New Case" → 
Selects client from dropdown → Fills 15+ fields → Saves →
Uploads documents → Adds line items manually
```

**PM Challenge:** Why does the broker need to create a case at all?

A case begins when a client sends documents for a shipment. The email IS the case creation event. Everything needed to create the case already exists in that email and its attachments:

| Field | Where it already exists |
|-------|------------------------|
| Client | Email sender address (matched to known clients) |
| Type (Import/Export) | Invoice context, port names, shipping direction |
| Bill of Lading | BL document or email body |
| Port, Vessel, Voyage | BL document |
| Line items, quantities, values | Invoice |
| HS codes | AI inference from product descriptions |
| Country of origin | Invoice or CO document |
| Deadline | Estimated arrival date from BL |

**Redesigned workflow:**

```
1. Email arrives from 李经理 <lmg@sony.com.cn>
2. Harbor matches sender → Sony Electronics (existing client)
3. AI reads subject: "7月进口音响文件"
4. AI processes attachments: Invoice.pdf, PackingList.xlsx, BL.pdf
5. AI extracts all structured data from all documents simultaneously
6. AI creates a draft case with EVERYTHING pre-filled
7. AI sets status to "DRAFT_AI — 待确认"
8. Broker receives ONE notification: 
   "🤖 索尼进口音响 CB-2026-0045 已自动创建 · 8项商品 · HS编码建议就绪 · 点击确认"
```

**The broker's only action:** Review and click **"确认"** (Confirm). That's it. One click.

If something is wrong, the broker edits inline — but the DEFAULT path is zero manual entry.

**What we removed:**
- The entire "New Case" form (15+ fields)
- The document upload step
- The client selection dropdown
- The line item entry form
- The "create case" button itself

**Error prevention:** AI cross-validates across documents. If the invoice says "Sony" but the BL says "Panasonic", the case is flagged as "需人工核对 — 单据信息不一致" before the broker ever sees it.

---

### 2.2 Status Management — KILL THE DROPDOWN

**Current design:**
```
Broker manually selects new status from dropdown → 
clicks button → status changes
```

**PM Challenge:** Status is a reflection of reality. Why is the broker manually updating a reflection instead of the software detecting reality?

**Redesigned — Event-driven status:**

| Trigger Event | Automatic Status Change |
|--------------|------------------------|
| All required documents collected & verified | DRAFT → READY |
| Broker sends declaration to customs (detected via email or broker confirms) | READY → SUBMITTED |
| Customs acknowledgement email received | SUBMITTED → UNDER_REVIEW |
| Customs query email received (contains keywords: 查验, 补税, 说明) | UNDER_REVIEW → QUERY_RAISED |
| Broker sends response to customs query | QUERY_RAISED → UNDER_REVIEW |
| Customs release notification received (放行通知) | UNDER_REVIEW → CLEARED |
| 3 days after clearance with no issues | CLEARED → CLOSED (auto) |

**The broker's only action:** In ambiguous cases, the system asks: "检测到海关放行通知。标记为已放行?" → [确认] or [暂不]

**What we removed:**
- The status dropdown entirely
- The multi-button transition UI
- Status update as a conscious task

**Error prevention:** The system detects impossible situations. If customs sends a "release" email but the case status is still DRAFT, the system alerts: "⚠️ 数据异常: 收到放行通知但案件尚未提交。请核实。"

---

### 2.3 Email Processing — NO SECOND INBOX

**Current design:**
```
Broker checks Harbor inbox → reads emails → manually links to cases →
marks as processed → switches to case view to take action
```

**PM Challenge:** Harbor should not be another inbox the broker has to check. The broker already has email. Creating a second inbox is creating work.

**Redesigned — Invisible email processing:**

Emails are not something brokers "process." Emails are **events** that update cases.

```
Email arrives:
├── AI classification: NEW_SHIPMENT → Creates draft case (see 2.1)
├── AI classification: DOCUMENT_UPDATE → Attaches to case, marks docs received
├── AI classification: CUSTOMS_QUERY → Updates case status, creates reply task
├── AI classification: CLIENT_QUESTION → Shows in case feed, creates follow-up task
├── AI classification: GENERAL/SPAM → Ignored (not shown to broker)
```

The broker does NOT have an inbox to process. Instead, they have a **single prioritized feed**:

```
┌─────────────────────────────────────────────────────────┐
│  🔔 需要你处理 (3)                                       │
│                                                         │
│  🔴 海关查询 — 需回复                                    │
│     CB-2026-0045 索尼音响                                │
│     海关要求补充原产地证                                  │
│     截止: 明天 17:00                                     │
│     [📝 回复邮件]  [✅ 标记已处理]                           │
│                                                         │
│  🟡 待确认 — AI创建的案件                                 │
│     CB-2026-0048 (新) 东芝电子进口                        │
│     AI已提取6项商品，HS编码置信度92%                      │
│     [✅ 确认] [📝 修改]                                  │
│                                                         │
│  🟡 待确认 — AI提取的数据                                 │
│     CB-2026-0043 三菱电机                                 │
│     发票 INV-2026-078 已提取，3项商品，1项置信度低        │
│     [✅ 全部确认] [🔍 查看低置信度项]                     │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **No separate inbox page.** Emails appear in context (on the case) or in the attention feed.
- **Every item has a single primary action.** No "what do I do with this?" cognitive load.
- **AI pre-processes everything.** The broker only sees items that need human judgment.
- **Standard acknowledgment emails are auto-filed.** "收到了，谢谢" → automatically marked as read and archived in the system (NO reply is sent — the AI never sends emails). The broker doesn't need to click through these.

**What we removed:**
- The email inbox page (emails live on case pages + attention feed)
- Manual email-to-case linking
- "Mark as read" as a conscious action
- Email triage as a workflow

---

### 2.4 Document Processing — ZERO-CLICK EXTRACTION

**Current design:**
```
Upload doc → OCR → AI extract → Broker reviews → Broker corrects → Broker confirms
```

**PM Challenge:** If AI confidence is high, why does the broker need to review? If AI confidence is low, why show all fields instead of just the uncertain ones?

**Redesigned — Confidence-gated review:**

| AI Confidence | System Behavior |
|--------------|-----------------|
| ≥ 95% | Auto-accept. No broker review needed. Field marked with green check. |
| 85–95% | Accept, but show subtle indicator. Broker CAN review if they want. |
| 70–85% | Flag for review. Show only these fields, not all of them. |
| < 70% | Block. Don't pre-fill. Ask broker to enter manually. |

**The broker only sees:**
```
┌─────────────────────────────────────────────┐
│  📄 Invoice INV-2026-078                    │
│                                              │
│  ✅ 自动确认 (6项)                           │
│     Invoice No: INV-2026-078                │
│     Date: 2026-07-15                        │
│     Total: $85,000.00                       │
│     Currency: USD                           │
│     Buyer: Sony Electronics                 │
│     Seller: Sony Japan                      │
│                                              │
│  ⚡ 需确认 (1项)                              │
│     HS Code: 8518.2900.00 (78% confidence)  │
│     AI建议: 8518.2900.00 — 扬声器部件        │
│     备选: 8518.2100.00 — 单扬声器            │
│     备选: 8518.2200.00 — 多扬声器            │
│     [选择] [手动输入]                        │
└─────────────────────────────────────────────┘
```

**What we removed:**
- Reviewing fields AI got right (wasted time)
- The "verify all fields" step
- Manual data entry for high-confidence fields

**Error prevention:** AI cross-references across documents. If the invoice total ($85,000) doesn't match the sum of line items ($82,500), the system flags a discrepancy BEFORE the broker reviews.

---

### 2.5 HS Code Classification — DON'T ASK, JUST TELL

**Current design:**
```
Broker types product → clicks "Suggest HS Code" → 
AI returns suggestions → broker picks one
```

**PM Challenge:** Why is this a separate action the broker initiates?

**Redesigned:**

HS codes are classified automatically when documents are processed. The broker doesn't "request" classification — it's already done.

- High confidence (>90%): Code is applied. Broker sees it in the case. No action needed.
- Medium confidence (70-90%): Code is applied with a subtle "AI建议" indicator. Broker CAN change it but doesn't have to.
- Low confidence (<70%): Top 3 suggestions shown. Broker picks.
- Known product (same product classified before): Historical classification reused. 100% auto.

**Learning loop:** When a broker corrects an AI HS code from X to Y, that correction is stored. Next time the same product (same client, same description) appears, the system uses Y without asking.

**What we removed:**
- The "Suggest HS Code" button
- HS code as a separate workflow step
- Re-classifying the same product multiple times

---

### 2.6 Task & Deadline Management — AI AS THE REMEMBERER

**Current design:**
```
Broker creates tasks manually → sets due dates → 
system sends reminders
```

**PM Challenge:** The system knows the case context better than the broker's memory. Why ask the broker to create tasks?

**Redesigned — Auto-generated tasks:**

| Trigger | Auto-generated Task |
|---------|-------------------|
| Case created, HS code requires permit | "📋 确认客户已提供{许可证类型}" due in 2 days |
| Customs query received | "📝 回复海关查询" due based on customs deadline in email |
| Document extraction confidence < 70% | "🔍 手动核对{商品名}申报要素" due today |
| Client hasn't sent required docs after 3 days | "📧 跟进客户索要{缺失文件}" auto-sent, task: "确认客户回复" |
| Estimated arrival date approaching | "🚢 {提单号}预计{日期}到港 — 确认申报准备" |
| Duty payment needed | "💰 缴纳关税 ¥{金额} — 截止{日期}" |

The broker doesn't create tasks. Tasks create themselves. The broker can:
- Add personal notes to auto-tasks
- Snooze (remind later)
- Complete
- Create ONE-OFF custom tasks (edge case, not the primary path)

**What we removed:**
- The "Create Task" form as primary workflow
- Manual deadline entry
- Remembering regulatory requirements (the system knows them)

---

### 2.7 Search — DON'T SEARCH, FIND

**Current design:**
```
Broker types query → clicks search → reviews results → 
clicks into items
```

**PM Challenge:** If the broker has to search, the system already failed to surface the right information.

**Redesigned — Proactive information:**

80% of "searches" are actually:
- "What's the status of the Sony case?" → Visible on dashboard
- "Show me the invoice from last month" → Already linked to the case
- "When did we submit that declaration?" → Visible on case timeline

The search bar should be the **last resort**, not the primary navigation.

**Natural language command bar (⌘K):**
```
"索尼的案子到哪了" → Navigates to Sony's active case
"上周提交了几个报关单" → Shows count + list
"锂电池需要什么文件" → Shows regulatory requirements (RAG)
"找 INV-2026-078" → Opens that document
```

But the PRIMARY design principle: the broker shouldn't need to search. Information should be exactly where they expect it.

**What we removed:**
- The search page as a primary navigation item
- Complex filter UIs (replaced with natural language)

---

## 3. The Redesigned Information Architecture

### CURRENT (mirrors the broker's old workflow):
```
Sidebar: Dashboard | Cases | Emails | Clients | Tasks | Search
```

### REDESIGNED (organizes by what the broker needs to DO):
```
Sidebar:
  🔔 需要处理 (attention feed — prioritized)
  📋 案件 (cases — searchable list)
  👥 客户 (clients)
  🔍 搜索 (command bar, always accessible via ⌘K)
```

The inbox, tasks, and dashboard merge into ONE view: **需要处理 (Needs Attention)**. This is the default landing page.

---

## 4. The "Zero-Entry" Principle

For every piece of data the system needs, ask: **Can the system get this without the broker typing it?**

| Data Need | Source (no typing) |
|-----------|-------------------|
| Client identity | Email sender → client database match |
| Product descriptions | Invoice OCR → AI extraction |
| Quantities, values | Invoice OCR → AI extraction |
| HS codes | AI classification from product description + historical data |
| Port, vessel, voyage | Bill of Lading OCR |
| Country of origin | Invoice / CO OCR |
| Deadlines | Email content + shipping schedule |
| Customs queries | Email content parsing |
| Duty rates | HS code → tariff database lookup |
| Regulatory requirements | HS code → regulatory conditions DB |

**The only things a broker should ever type:**
1. Internal notes (judgment, context, client preferences)
2. Corrections to AI errors
3. All email replies to customs, clients, and third parties
4. One-off tasks that no rule can predict

Everything else is data the system can and should capture automatically.

---

## 5. Error Prevention Design

### Current: System lets brokers make mistakes, then they deal with consequences.

### Redesigned: The system prevents mistakes BEFORE they happen.

| Mistake | Prevention |
|---------|-----------|
| Wrong HS code | Cross-reference with product description; flag if mismatch |
| Missing required document | HS code → required docs checklist; warn if missing before submission |
| Wrong client on case | Email sender doesn't match case client → flag |
| Declaration value mismatch | Invoice total ≠ sum of line items → flag |
| Missing 申报要素 | HS code → required elements template; warn if incomplete |
| Duplicate case | Same BL number, same client → "可能重复: CB-2026-0041" |
| Expired permit | Permit document → expiry date tracking → alert before expiry |
| Wrong port | Port doesn't match shipping route → flag |
| Late submission | Deadline tracking → escalate BEFORE deadline, not after |

### The "Guardian" Pattern:
Before any significant action (status change, declaration submission, client communication), the system runs a **guardian check**:

```
┌─────────────────────────────────────────────┐
│  ⚠️ 提交前检查                               │
│                                              │
│  ✅ 必要文件已齐全 (5/5)                     │
│  ✅ HS编码已确认                             │
│  ✅ 申报要素已填写                           │
│  ⚠️ 原产地证将于8月15日过期 — 建议提醒客户    │
│  ⚠️ 申报金额与发票差额$2,500 — 请核实        │
│                                              │
│  [忽略警告，继续提交]  [返回修改]             │
└─────────────────────────────────────────────┘
```

---

## 6. What Gets CUT Entirely

These features existed in the original design. After PM review, they are CUT:

| Feature | Reason for Removal |
|---------|-------------------|
| Separate email inbox page | Emails merged into case views + attention feed |
| Manual task creation form | Tasks auto-generated from case context |
| Document upload button as primary action | Documents come from email integration |
| Status dropdown with multiple buttons | Event-driven auto-status |
| "Suggest HS Code" button | Auto-classified on document ingestion |
| Separate dashboard page | Merged into "需要处理" attention feed |
| Case creation form (15 fields) | AI auto-creates cases from emails |
| Manual client selection during case creation | Auto-matched from email sender |
| "Mark as read" for emails | Status auto-managed |

These are NOT "nice to have someday." They are cut from Day 1. The system ships without them.

---

## 7. The New User Experience

### A Broker's Day with Redesigned Harbor:

**9:00 AM** — Opens Harbor. Lands on **需要处理**.

Sees 3 items:
1. 🔴 "海关查询 — 索尼案件需补充文件 · 截止明天" [回复]
2. 🟡 "新案件待确认 — 东芝进口" [AI已预填全部信息]  
3. 🟡 "数据待核实 — 1项HS编码置信度低"

**9:02 AM** — Clicks item 1. Sees the customs query. Writes a reply based on the case context the system has gathered. Clicks **发送**.

**9:04 AM** — Clicks item 2. Reviews pre-filled case. All looks good. Clicks **确认**. Case moves to DOCUMENTS_COLLECTING.

**9:05 AM** — Clicks item 3. Sees two HS code options. Selects the correct one. Done.

**9:06 AM** — Attention feed is empty. Broker's cognitive work for the morning is done in 6 minutes instead of 45 minutes.

The broker can now:
- Proactively review upcoming shipments
- Call clients about complex cases
- Research new regulations
- Have lunch without anxiety about forgotten tasks

**This is the metric:** Not "features shipped" but **"minutes of broker attention required per case."** Currently maybe 45 minutes of software interaction per case. Target: under 10 minutes.

---

## 8. Revised Development Priorities

Given this redesign, the development phases shift:

### Phase 1 (Must Have — Day 1):
- [ ] AI auto-case-creation from ingested emails
- [ ] AI document extraction with confidence-gated review
- [ ] Auto-HS-code classification with learning
- [ ] Unified attention feed (replaces dashboard + tasks + inbox)
- [ ] Event-driven status management
- [ ] Guardian pre-submission checks

### Phase 2 (Soon After):
- [ ] Natural language command bar (⌘K)
- [ ] Auto-task generation
- [ ] Cross-document discrepancy detection
- [ ] Client auto-matching from email

### Phase 3 (Later):
- [ ] WeChat integration
- [ ] 单一窗口 API integration (auto-fill)
- [ ] Full RAG regulation Q&A
- [ ] Analytics and trend detection

---

## 9. Success Metrics

The software is successful if:

1. **Broker keystrokes per case < 100** (excluding free-text notes and email replies)
2. **Broker clicks per case < 20** (from ingestion to submission)
3. **Cases requiring manual data entry < 30%** (AI handles the rest)
4. **Missed deadlines → 0** (system catches everything)
5. **Time from email arrival to case creation < 30 seconds** (automated)
6. **Broker can go from 0 → productive in 30 minutes** (no training needed)

---

## Summary

The original design digitized the brokerage workflow. It was a good filing cabinet.

The redesigned system **eliminates** the workflow. It's an AI executive assistant that:

- **Creates** cases so brokers don't have to
- **Extracts** data so brokers don't have to type
- **Classifies** products so brokers just confirm
- **Surfaces** what needs a reply so brokers know exactly what to address
- **Remembers** deadlines so brokers don't have to
- **Checks** for errors so brokers don't make mistakes
- **Surfaces** what needs attention so brokers don't have to search

The broker's job becomes: **review, decide, communicate.** Everything else is the software's job.
