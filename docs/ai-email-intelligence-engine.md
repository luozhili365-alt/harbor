# AI Email Intelligence Engine — Complete Design

**Status:** Design Document  
**Principle:** The AI doesn't extract text. It understands the business event the email represents and acts on it.

---

## ⛔ NON-NEGOTIABLE: AI NEVER SENDS EMAILS

```
AI 可以做的事情（自动执行，无需人工确认）:
  ✅ 读取邮件、分类邮件
  ✅ 提取数据、写入数据库
  ✅ 创建案件、更新案件状态
  ✅ 关联邮件到案件
  ✅ 生成任务、计算截止日期

AI 不可以做的事情（绝对禁止，代码层面强制阻止）:
  ❌ 发送任何邮件
  ❌ 回复任何邮件
  ❌ 起草任何回复草稿
  ❌ 生成任何回复模板
  ❌ 通过 SMTP 连接发送任何内容
  ❌ 通过任何其他渠道（微信、短信等）代表经纪人发送消息
  
  代码层面: AI 模块不存在任何与邮件回复相关的函数、类、方法、或数据结构。
  AI 的 JSON 输出中不包含任何与回复内容相关的字段。
```

**为什么这是不可妥协的：**

1. **法律责任** — 报关行对提交给海关的每一份文件承担法律责任。AI 发送的邮件在法律上等同于经纪人发送的邮件。如果 AI 向海关发送了错误信息，承担后果的是经纪人，而非软件。

2. **客户信任** — 客户与经纪人之间的关系建立在信任基础上。如果客户发现是 AI 在回复他们的邮件，而非经纪人本人，这种信任将瞬间瓦解。

3. **不可逆性** — 发送邮件是不可逆的操作。AI 可以创建案件、提取数据、建议 HS 编码——这些都可以由经纪人修改或撤销。发送邮件不能撤销。

4. **海关沟通的特殊性** — 与海关的沟通具有法律效力。错误的海关回复可能导致：罚款、货物扣留、退单、甚至企业信用等级降级。

**代码层面的强制保护：**

```
SMTP 发送模块的设计:
  - smtp_service.send_email() 函数不接受任何来自 AI 模块的直接调用
  - 只有来自前端（经纪人手动点击"发送"按钮）的 API 请求才能触发邮件发送
  - AI 模块不导入、不引用、不依赖 smtp_service
  - 后端 API 层面：POST /api/v1/emails/send 不接收任何 ai_* 参数
  - 后端 API 层面：POST /api/v1/emails/send 必须有有效的用户 JWT token
  - 代码审查检查点：任何 AI 模块 import smtp 将导致 CI 失败
```

**一句话总结：邮件的发送、回复、起草，100% 由人类完成。AI 不参与任何与邮件回复相关的工作。**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Intelligence Pipeline](#2-the-intelligence-pipeline)
3. [Stage 1: Preprocessing](#3-stage-1-preprocessing)
4. [Stage 2: AI Understanding (The Prompt)](#4-stage-2-ai-understanding)
5. [Stage 3: Business Logic Resolution](#5-stage-3-business-logic-resolution)
6. [Stage 4: Case Matching Algorithm](#6-stage-4-case-matching-algorithm)
7. [Stage 5: Deadline Calculation Engine](#7-stage-5-deadline-calculation-engine)
8. [Stage 6: Database Persistence](#8-stage-6-database-persistence)
9. [Stage 7: Real-Time UI Updates](#9-stage-7-real-time-ui-updates)
10. [Error Handling & Confidence Gates](#10-error-handling--confidence-gates)
11. [Learning & Feedback Loop](#11-learning--feedback-loop)
12. [Edge Cases & Resilience](#12-edge-cases--resilience)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    EMAIL INTELLIGENCE ENGINE                       │
│                                                                    │
│  IMAP Inbound Email                                                │
│       │                                                            │
│       ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STAGE 1: Preprocessing                                      │  │
│  │  • MIME parsing          • Language detection                │  │
│  │  • Thread reconstruction  • Attachment extraction            │  │
│  │  • Deduplication          • Sender reputation lookup         │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STAGE 2: AI Understanding (Single LLM Call)                 │  │
│  │  • Business classification   • Entity extraction             │  │
│  │  • Case matching             • Deadline identification       │  │
│  │  • Action generation         • Confidence scoring            │  │
│  │  Returns: Structured JSON (see Section 4)                    │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STAGE 3: Business Logic Resolution                          │  │
│  │  • Resolve case matching (AI suggestion → DB verification)  │  │
│  │  • Calculate absolute deadlines from relative expressions   │  │
│  │  • Cross-reference with regulatory requirements             │  │
│  │  • Detect discrepancies across documents                    │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STAGE 4: Database Persistence                               │  │
│  │  • Save/update email record                                  │  │
│  │  • Create/update case                                        │  │
│  │  • Save extracted entities                                   │  │
│  │  • Create tasks for deadlines                                │  │
│  │  • Log all AI actions for audit                              │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STAGE 5: UI Updates (Server-Sent Events)                    │  │
│  │  • Dashboard attention feed refresh                          │  │
│  │  • Case page live update                                     │  │
│  │  • Browser notification (if urgent)                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Design Decisions

**Why ONE LLM call, not a chain?**
- A customs email contains interdependent information. The business category ("customs query") affects what entities are relevant. The client identity affects which cases to match against.
- Running classification → then extraction → then matching as separate calls means each step loses context that earlier steps had.
- One comprehensive prompt with structured output is: faster (1 API call vs 3–5), cheaper (single token cost), and more accurate (full context).

**Why structured JSON output, not free text?**
- The email engine must feed a database, not a human. Free text requires a second parsing step that introduces errors.
- Structured output is directly machine-actionable. The business logic layer doesn't parse — it executes.
- Modern LLMs (Claude, GPT-4) support guaranteed JSON schema output.

**Why on-premise preprocessing + cloud AI?**
- MIME parsing, dedup, thread reconstruction → no AI needed, fast local processing.
- Only the email body (text) + structured metadata goes to the cloud LLM.
- Attachments are OCR'd on-premise first, then only text is sent.

---

## 2. The Intelligence Pipeline

### Complete Data Flow

```
Email arrives at IMAP server
        │
        ▼
┌──────────────────────────────────────┐
│ Polling worker picks up new email    │
│ (every 60 seconds, configurable)     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ PREPROCESSING (on-premise, no AI)    │
│                                      │
│ 1. Parse MIME structure              │
│ 2. Extract plain text + HTML body    │
│ 3. Download attachments → MinIO      │
│ 4. Compute SHA256 of each attachment │
│ 5. Check Message-ID against emails   │
│    table → if exists, SKIP (dedup)   │
│ 6. Reconstruct thread: find all      │
│    emails with same thread_id        │
│ 7. Detect language (zh/en/mixed)     │
│ 8. Look up sender in clients table   │
│    → attach client_id, company_name  │
│    if known                           │
│ 9. OCR attachments (async, parallel) │
│    → attach OCR text to context      │
│ 10. Build the AI context payload     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ AI UNDERSTANDING (cloud LLM)         │
│                                      │
│ Input: Email text + thread context   │
│        + OCR text from attachments   │
│        + Known client info           │
│        + Open cases for this client  │
│        + Historical classifications  │
│                                      │
│ Output: Structured JSON              │
│   (see Section 4 for full schema)    │
│                                      │
│ ⏱️ ~3-8 seconds per email            │
│ 💰 ~$0.02-0.08 per email (Claude)    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ BUSINESS LOGIC (on-premise)          │
│                                      │
│ 1. Validate AI output structure      │
│ 2. Check confidence thresholds       │
│ 3. Resolve case matching             │
│ 4. Calculate absolute deadlines      │
│ 5. Cross-reference with regulations  │
│ 6. Determine database operations     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ DATABASE TRANSACTION                 │
│                                      │
│ All writes in one atomic transaction │
│ (see Section 8 for details)          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ UI UPDATE                            │
│                                      │
│ SSE push to all connected clients    │
│ (see Section 9 for details)          │
└──────────────────────────────────────┘
```

---

## 3. Stage 1: Preprocessing

This stage runs entirely on-premise. No AI. No cloud.

### 3.1 Thread Reconstruction

Emails are not isolated — they're conversations. The AI needs context.

```
Strategy:
1. Parse References: and In-Reply-To: headers from the email
2. Query emails table for all emails in the same thread
3. Build a chronological thread summary (max 10 previous emails)
4. Include in AI context: sender, subject, date, first 200 chars of body
   for each previous email

Why: A customs query email that says "请参考上次回复" makes no sense
without the thread context. The AI needs to see the whole conversation.
```

### 3.2 Sender Reputation & Client Matching

```
Strategy:
1. Extract sender email address
2. Query clients table: WHERE contact_email = sender_email
   OR WHERE billing_email = sender_email
3. Also check email domain: emails from @sony.com → 
   search for "sony" in client company names
4. Also check email signature patterns from past emails
5. Return: { matched: true/false, client_id: "...", confidence: 0.95 }

Why: If we already know the sender is 李经理 from 索尼, 
we can skip client matching in the AI call entirely and 
just pass the client_id. This is faster and more reliable.
```

### 3.3 OCR Queue Management

```
Strategy:
- Attachments are OCR'd IMMEDIATELY on ingestion
- OCR runs in parallel for all attachments (up to 5 concurrent)
- PaddleOCR for Chinese docs, Tesseract for English
- If OCR takes > 30 seconds, the AI call proceeds WITHOUT 
  that attachment's text, and the attachment is re-processed
  when OCR completes (partial understanding now, full later)
- OCR text is cached on the document record for reuse

Why: We can't make the broker wait 45 seconds for OCR
before they see anything. Partial understanding is better
than delayed understanding.
```

### 3.4 The Context Payload

This is what gets sent to the AI. Every field is chosen to maximize understanding while minimizing token usage:

```
CONTEXT PAYLOAD (sent to LLM):

1. EMAIL_UNDER_ANALYSIS:
   - from_addr, from_name
   - to_addrs, cc_addrs
   - subject
   - body_text (full, cleaned)
   - received_at

2. THREAD_CONTEXT (if thread exists):
   - Previous 10 emails in thread, each with:
     { from, subject, date, first_200_chars }

3. KNOWN_CLIENT (if sender matched):
   - company_name, company_name_en
   - customs_code, customs_grade
   - client_id

4. OPEN_CASES_FOR_CLIENT (if client matched):
   - case_no, status, bill_of_lading, vessel_name,
     estimated_arrival, items summary
   - Max 5 most recent open cases

5. RECENT_CLASSIFICATIONS (for HS code learning):
   - Last 10 HS code assignments by this brokerage
     { product_description, hs_code }

6. OCR_TEXT (from attachments, if available):
   - doc_type, extracted_text (truncated to 3000 chars each)

7. CURRENT_DATE: 2026-07-21
   (CRITICAL for deadline calculation)
```

---

## 4. Stage 2: AI Understanding

### 4.1 The System Prompt

This is the core instruction set. It defines the AI's persona, domain knowledge, and output contract.

```
You are an AI customs brokerage assistant for a China-based brokerage firm.

You analyze inbound business emails and extract structured information
for automatic case management.

DOMAIN CONTEXT:
- You handle China import/export customs declarations (报关单)
- Clients are Chinese companies importing/exporting goods
- Common document types: Commercial Invoice (发票), Packing List (装箱单),
  Bill of Lading (提单), Certificate of Origin (原产地证), Import/Export Permit (许可证)
- China HS codes are 10 digits
- Common ports: 深圳, 上海, 广州, 宁波, 天津, 青岛, 大连, 厦门
- Customs types: IMPORT (进口) or EXPORT (出口)
- Common supervision modes: 一般贸易, 加工贸易, 保税物流
- Incoterms: FOB, CIF, C&F, EXW, DDP

YOUR TASK:
Read the email and ALL provided context. Understand the BUSINESS EVENT
this email represents. Return a complete structured analysis.

CRITICAL RULES:
1. For every field you extract, provide a confidence score (0.0-1.0).
2. If you are UNSURE about something, set confidence < 0.7.
3. Distinguish between: documents ATTACHED to this email vs.
   documents MENTIONED as needed vs. documents REQUIRED by regulation.
4. For deadlines: if the email says "90 days after arrival", 
   set deadline_type: "RELATIVE" and anchor_event: "ARRIVAL" — 
   do NOT calculate absolute dates. The system will calculate them.
5. For deadlines: if the email gives an absolute date ("2026-08-15"),
   set deadline_type: "ABSOLUTE" and provide the date directly.
6. Case matching: check for case numbers (CB-2026-XXXX), 
   B/L numbers, container numbers, declaration numbers.
   If found, match confidently. If only client matches,
   check if there's an open case for this client with similar goods.
7. Auto-create vs. auto-update: if this is clearly a NEW shipment
   (new B/L, new container, new invoice), flag as NEW_CASE.
   If it references an existing case or shipment, flag as CASE_UPDATE.
8. Contact extraction: identify ALL people mentioned — 
   client contacts, factory contacts, forwarders, customs officers.
9. All dates must be in YYYY-MM-DD format.
10. All monetary values must include currency.
```

### 4.2 The Structured Output Schema

This is the JSON schema the AI must return. **One call. One output. All decisions included.**

```json
{
  "business_understanding": {
    "primary_category": "NEW_SHIPMENT | CASE_UPDATE | CUSTOMS_QUERY | DOCUMENT_SUBMISSION | DOCUMENT_REQUEST | CLIENT_QUERY | SHIPMENT_STATUS | PAYMENT_NOTICE | GENERAL | SPAM",
    "secondary_categories": [],
    "urgency": "URGENT | HIGH | NORMAL | LOW",
    "urgency_reason": "海关查验通知，3个工作日内需回复",
    "summary_cn": "索尼电子发送7月进口音响的发票和装箱单，提单号SZX20260715001",
    "summary_en": "Sony Electronics sends invoice and packing list for July speaker import, B/L SZX20260715001",
    "sentiment": "NEUTRAL | POSITIVE | NEGATIVE | URGENT",
    "requires_human_attention": true,
    "attention_reason": "AI confidence on HS code classification is below threshold"
  },

  "case_matching": {
    "is_new_case": false,
    "match_confidence": 0.96,
    "matched_case_id": "uuid-of-CB-2026-0045",
    "matched_by": [
      {"method": "B/L_NUMBER", "value": "SZX20260715001", "confidence": 0.99},
      {"method": "CLIENT_MATCH", "value": "索尼电子(深圳)有限公司", "confidence": 0.95},
      {"method": "SUBJECT_REFERENCE", "value": "7月进口", "confidence": 0.80}
    ],
    "alternative_match_ids": [],
    "matching_reasoning": "提单号SZX20260715001匹配案件CB-2026-0045。发件人李经理是索尼常规联系人。主题'7月进口'与案件时间吻合。"
  },

  "entities": {
    "client": {
      "company_name_cn": "索尼电子(深圳)有限公司",
      "company_name_en": "Sony Electronics (Shenzhen) Co., Ltd.",
      "contact_person": "李经理",
      "contact_email": "lmg@sony.com.cn",
      "contact_phone": null,
      "confidence": 0.97
    },
    "factory": {
      "name_cn": "索尼株式会社",
      "name_en": "Sony Corporation",
      "address": "日本东京都港区...",
      "country": "日本",
      "confidence": 0.85
    },
    "supplier": {
      "name_cn": null,
      "name_en": null,
      "confidence": 0.0
    },
    "forwarder": {
      "company": "DHL Global Forwarding",
      "contact": null,
      "confidence": 0.70
    },

    "shipment": {
      "container_numbers": [
        {"number": "TCLU1234567", "confidence": 0.99},
        {"number": "TCLU8901234", "confidence": 0.99}
      ],
      "bill_of_lading": {"number": "SZX20260715001", "confidence": 0.99},
      "vessel_name": {"name": "EVER FORTUNE", "confidence": 0.95},
      "voyage_number": {"number": "V.123E", "confidence": 0.92},
      "eta": {"date": "2026-07-28", "confidence": 0.95},
      "etd": {"date": "2026-07-15", "confidence": 0.90},
      "port_of_loading": {"name": "东京港", "code": "JPTYO", "confidence": 0.90},
      "port_of_discharge": {"name": "深圳港", "code": "CNSZX", "confidence": 0.95},
      "country_of_origin": "日本",
      "country_of_destination": "中国",
      "transport_mode": "海运",
      "gross_weight_kg": null,
      "package_count": null,
      "confidence": 0.93
    },

    "customs_info": {
      "type": "IMPORT",
      "supervision_mode": "一般贸易",
      "transaction_method": "CIF",
      "declared_currency": "USD",
      "declared_value_total": 85000.00,
      "freight_amount": null,
      "insurance_amount": null,
      "confidence": 0.90
    },

    "products": [
      {
        "sequence": 1,
        "name_cn": "音响扬声器单元",
        "name_en": "Speaker Driver Unit",
        "brand": "Sony",
        "model": "SP-500",
        "specification": "50W, 8Ω",
        "quantity": 1000,
        "unit": "个",
        "unit_price": 50.00,
        "total_price": 50000.00,
        "currency": "USD",
        "hs_code_suggestion": "8518.2900.00",
        "hs_code_confidence": 0.92,
        "hs_code_reasoning": "扬声器部件，非完整音箱系统，用于音频设备制造",
        "country_of_origin": "日本",
        "requires_permit": false,
        "requires_ciq": false,
        "confidence": 0.91
      },
      {
        "sequence": 2,
        "name_cn": "音频放大器模块",
        "name_en": "Audio Amplifier Module",
        "brand": "Sony",
        "model": "PA-200",
        "specification": "200W, Class D",
        "quantity": 500,
        "unit": "个",
        "unit_price": 70.00,
        "total_price": 35000.00,
        "currency": "USD",
        "hs_code_suggestion": "8518.4000.00",
        "hs_code_confidence": 0.88,
        "hs_code_reasoning": "音频放大器，独立模块，非整机",
        "country_of_origin": "日本",
        "requires_permit": false,
        "requires_ciq": false,
        "confidence": 0.88
      }
    ],

    "documents": {
      "attached": [
        {
          "type": "INVOICE",
          "filename": "Commercial Invoice.pdf",
          "description": "索尼SP-500和PA-200的商业发票",
          "confidence": 0.99
        },
        {
          "type": "PACKING_LIST",
          "filename": "Packing List.xlsx",
          "description": "装箱明细",
          "confidence": 0.99
        },
        {
          "type": "BILL_OF_LADING",
          "filename": "Bill of Lading.pdf",
          "description": "海运提单",
          "confidence": 0.98
        }
      ],
      "mentioned_but_missing": [
        {
          "type": "CERTIFICATE_OF_ORIGIN",
          "description": "原产地证",
          "status": "客户说会稍后发送",
          "confidence": 0.90
        }
      ],
      "required_by_regulation": [
        {
          "type": "CERTIFICATE_OF_ORIGIN",
          "reason": "该HS编码需要原产地证以享受FTA优惠关税",
          "regulation_ref": "中日自贸协定",
          "confidence": 0.85
        }
      ]
    },

    "deadlines": [
      {
        "id": "dl_1",
        "description": "预计到港日期",
        "type": "ABSOLUTE",
        "date": "2026-07-28",
        "is_hard_deadline": false,
        "source": "提单显示ETA",
        "confidence": 0.95
      },
      {
        "id": "dl_2",
        "description": "海关要求补充原产地证截止",
        "type": "RELATIVE",
        "raw_expression": "收到通知后5个工作日内",
        "anchor_event": "CUSTOMS_NOTIFICATION_RECEIVED",
        "anchor_date": "2026-07-21",
        "relative_days": 5,
        "is_working_days": true,
        "is_hard_deadline": true,
        "source": "海关查验通知邮件",
        "confidence": 0.93
      }
    ],

    "contacts_extracted": [
      {
        "name": "李经理",
        "role": "采购经理",
        "company": "索尼电子(深圳)有限公司",
        "email": "lmg@sony.com.cn",
        "phone": null,
        "wechat": null,
        "confidence": 0.95
      },
      {
        "name": "田中",
        "role": "发货负责人",
        "company": "索尼株式会社",
        "email": "tanaka@sony.co.jp",
        "phone": null,
        "confidence": 0.80
      }
    ],

    "financial": {
      "invoice_number": "INV-2026-SNY-0715",
      "invoice_date": "2026-07-15",
      "payment_terms": "T/T 30 days",
      "incoterms": "CIF",
      "total_amount": 85000.00,
      "currency": "USD",
      "confidence": 0.97
    }
  },

  "actions": {
    "should_create_case": false,
    "should_update_case": true,
    "update_operations": [
      {
        "entity": "cases",
        "case_id": "uuid-of-CB-2026-0045",
        "field": "status",
        "new_value": "DOCUMENTS_COLLECTING",
        "reason": "已收到发票和装箱单，原产地证客户承诺稍后提供"
      },
      {
        "entity": "cases",
        "case_id": "uuid-of-CB-2026-0045",
        "field": "documents_received",
        "new_value": ["INVOICE", "PACKING_LIST", "BILL_OF_LADING"],
        "reason": "本次邮件附件"
      }
    ],
    "tasks_to_generate": [
      {
        "task_type": "DOC_REQUEST",
        "title": "跟进索尼原产地证",
        "description": "客户李经理说会稍后发送原产地证。如3天内未收到，需跟进。",
        "due_date": "2026-07-24",
        "priority": "HIGH",
        "case_id": "uuid-of-CB-2026-0045"
      },
      {
        "task_type": "DEADLINE",
        "title": "海关查验回复截止",
        "description": "5个工作日内补充原产地证",
        "due_date": "2026-07-28",
        "priority": "URGENT",
        "case_id": "uuid-of-CB-2026-0045"
      }
    ],
    "notification_message": "📋 CB-2026-0045: 收到索尼发票和装箱单。原产地证待补。海关查验需5个工作日内回复。"
  },

  "confidence": {
    "overall": 0.93,
    "business_category": 0.98,
    "case_matching": 0.96,
    "entity_extraction": 0.91,
    "deadline_interpretation": 0.93,
    "hs_code_classification": 0.90,
    "action_recommendation": 0.94
  }
}
```

### 4.3 Business Category Definitions

The AI classifies into ONE primary category. This drives all downstream behavior.

| Category | Definition | System Response |
|----------|-----------|----------------|
| `NEW_SHIPMENT` | First communication about a new shipment. Contains new B/L, new invoice, new goods. | Create draft case. Extract all entities. Queue document OCR. |
| `CASE_UPDATE` | Update about an existing case. Additional docs, confirmation, status change. | Update case with new info. Link email to case. Update document checklist. |
| `CUSTOMS_QUERY` | Official communication from customs: 查验通知, 补税通知, 退单通知, 询问函. | **URGENT flag.** Extract deadline. Auto-update case status to QUERY_RAISED. Create task: "回复海关查询 — {deadline}". Push notification. Broker writes and sends the reply entirely on their own. |
| `DOCUMENT_SUBMISSION` | Client sending documents. Primary purpose is the attachments. | Link docs to case. Update document checklist. If all docs received, suggest status → READY. |
| `DOCUMENT_REQUEST` | Someone is ASKING for documents (customs, broker asking client). | If from customs: treat as CUSTOMS_QUERY. If from broker to client: just log. |
| `CLIENT_QUERY` | Client asking a question: "When will my goods clear?", "What's the duty amount?" | Link to case. Create task: "回复客户查询". Broker handles the reply independently. Not urgent unless client seems anxious. |
| `SHIPMENT_STATUS` | Shipping update: vessel delay, arrival notice, port congestion. | Update ETA/ETD. Check if deadlines are affected. If ETA changes by > 3 days, flag for broker. |
| `PAYMENT_NOTICE` | Duty payment notice, tax invoice, payment confirmation. | Extract amounts. Create payment task with deadline. Link to case financials. |
| `GENERAL` | Work-related but not case-specific. Office admin, industry news, etc. | Low priority. Show in feed if unread > 3 days. |
| `SPAM` | Unsolicited commercial email, phishing, junk. | Auto-archive. Zero broker attention. Delete after 30 days. |

---

## 5. Stage 3: Business Logic Resolution

The AI returns structured JSON. Now the system resolves ambiguities and enforces business rules.

### 5.1 Case Matching Resolution

```
Input: AI's case_matching suggestion + confidence

Resolution rules:

IF match_confidence >= 0.95 AND matched_by contains exact identifier (B/L, container, case_no):
  → AUTO-LINK. No human review.

IF match_confidence >= 0.85 AND matched_by contains CLIENT_MATCH + CONTEXT:
  → LINK with "AI已关联" indicator. Broker CAN change but doesn't have to.

IF match_confidence >= 0.70 AND only matched by CLIENT_MATCH:
  → SUGGEST link. Show in attention feed: "可能关联CB-2026-0045?"
  → Broker confirms or rejects.

IF match_confidence < 0.70 OR is_new_case == true:
  → Create new draft case.

IF matched_case is CLOSED or CANCELLED:
  → Treat as NEW_CASE. Don't link to closed cases even if references match.
  → Add note: "注意: 提单号与已结关案件CB-2026-0023相同。可能是新批次。"
```

### 5.2 Cross-Validation Rules

After AI extraction, the system validates internally:

```
VALIDATION CHECKS:

1. INVOICE TOTAL vs LINE ITEMS:
   SUM(product.total_price) should ≈ declared_value_total
   If discrepancy > 5% → flag for broker review

2. PORT vs COUNTRY:
   Port of loading should be in country of origin (or transshipment hub)
   If mismatch → flag

3. HS CODE vs PRODUCT:
   If AI-suggested HS code has regulatory conditions requiring permits,
   but no permit is attached or mentioned → flag as "需要许可证"

4. ETA vs CURRENT DATE:
   If ETA is in the past → flag: "预计到港日期已过，请确认"

5. DUPLICATE DETECTION:
   Same B/L + same client + different email → possible duplicate
   Same invoice number + same client → possible duplicate

6. CLIENT CONSISTENCY:
   If sender is known client A but email references company B → flag
```

---

## 6. Stage 4: Case Matching Algorithm

### 6.1 Multi-Pass Matching Strategy

```
PASS 1: EXACT IDENTIFIER MATCH (confidence 0.95-1.0)
  Search cases table for:
  - case_no in email subject/body
  - bill_of_lading in email subject/body
  - container_numbers[] in email subject/body
  - declaration_number in email subject/body
  → If found: immediate match, skip remaining passes

PASS 2: CLIENT + SHIPMENT CONTEXT (confidence 0.75-0.94)
  Given: client_id from sender matching
  Search: open cases for this client
  Compare:
  - Same vessel_name + voyage_number
  - ETA within ±3 days of mentioned date
  - Similar product descriptions (fuzzy match)
  - Same port_of_entry
  → Score each open case. Return best match above threshold.

PASS 3: CROSS-CLIENT MATCH (confidence 0.50-0.74)
  Rare: what if sender is forwarder/customs, not client?
  Search: ALL open cases for matching B/L, container, vessel
  → If found, return match and note: "发件人非客户，可能为货代/海关"

PASS 4: NO MATCH
  → Flag as new case
```

### 6.2 Matching Weights

```
SCORING WEIGHTS (total = 1.0):

Bill of Lading exact match:      0.40  (strongest signal)
Container number exact match:    0.25
Case number reference:           0.20
Client + vessel + voyage match:  0.10
Client + product similarity:     0.03
Client + time proximity:         0.02

THRESHOLD: score >= 0.60 → auto-link
           0.35-0.60 → suggest link
           < 0.35 → new case
```

---

## 7. Stage 5: Deadline Calculation Engine

### 7.1 Expression Parsing

```
ABSOLUTE DATES:
  "2026年8月15日" → 2026-08-15
  "8/15/2026" → 2026-08-15 (US format)
  "15/8/2026" → 2026-08-15 (EU format)
  "Aug 15, 2026" → 2026-08-15
  "下周五" → calculate from email date
  "明天" → email date + 1 day
  "后天" → email date + 2 days

RELATIVE EXPRESSIONS:
  "到港后90天内" → anchor: ETA, +90 calendar days
  "收到通知后5个工作日内" → anchor: email received date, +5 working days
  "船开后3天内" → anchor: ETD, +3 calendar days
  "申报后15个工作日内" → anchor: case submitted_at, +15 working days
  "月底前" → last day of current month
  "下个月15号前" → 15th of next month
```

### 7.2 Working Day Calculation

```
WORKING DAYS DEFINITION:
  - Monday through Friday are working days
  - Saturday, Sunday are non-working days
  - Chinese public holidays are non-working days
  - The system maintains a holiday calendar (can be updated)

ALGORITHM:
  def add_working_days(start_date, days):
      current = start_date
      remaining = days
      while remaining > 0:
          current += 1 day
          if current is working day:
              remaining -= 1
      return current
```

### 7.3 Anchor Date Resolution

```
ANCHOR_EVENT → anchor_date resolution:

"ARRIVAL" or "ETA":
  → case.estimated_arrival
  → if null: AI-extracted ETA from this email
  → if null: cannot calculate, flag for broker

"DEPARTURE" or "ETD":
  → AI-extracted ETD from this email or documents
  → if null: cannot calculate

"SUBMISSION" or "申报":
  → case.submitted_at
  → if null: assume today (broker is about to submit)

"CUSTOMS_NOTIFICATION_RECEIVED" or "收到通知":
  → email.received_at (the email IS the notification)

"TODAY" or "现在":
  → email.received_at

"INVOICE_DATE":
  → AI-extracted from invoice

"BILL_OF_LADING_DATE":
  → AI-extracted from B/L
```

### 7.4 Deadline Creation Rules

```
For each extracted deadline:
  1. Resolve anchor date
  2. Calculate absolute deadline
  3. Set reminder: 2 working days BEFORE deadline
  (for URGENT: 1 working day before)
  4. Create task in database:
     - task_type: "DEADLINE"
     - title: "[description]"
     - due_date: [calculated date]
     - reminder_before: "2 days"
     - priority: URGENT if is_hard_deadline else HIGH
  5. If deadline is < 3 days away: push immediate notification
  6. If deadline is already past: push URGENT notification with 
     "已逾期X天" label
```

---

## 8. Stage 6: Database Persistence

### 8.1 Atomic Transaction

All writes for one email happen in a single database transaction:

```
BEGIN TRANSACTION;

1. INSERT or UPDATE emails table
   - status = 'UNREAD' (will be marked read when broker sees it)
   - ai_processed = true
   - ai_category, ai_priority, ai_summary, ai_action_needed
   - linked_case_id (if matched)

2. INSERT into email_extractions table (new table)
   - email_id
   - full_ai_response (JSONB) — the complete AI output
   - extraction_version = '1.0'
   - For each extracted product → link to case_item if exists

3. IF new case:
   - INSERT into cases
   - INSERT into case_items (for each product)
   - INSERT into activity_log: "CASE_CREATED_BY_AI"

4. IF existing case:
   - UPDATE cases (only fields with confidence >= 0.85)
   - For low-confidence updates: INSERT into suggested_updates
     (broker reviews later)
   - INSERT into activity_log for each change

5. IF documents attached:
   - UPDATE documents table (link to case, set doc_type from AI)
   - INSERT into activity_log: "DOCUMENT_RECEIVED"

6. FOR each deadline:
   - INSERT into tasks

7. FOR each missing document identified:
   - INSERT into tasks: task_type = "DOC_REQUEST"

8. INSERT into activity_log: "EMAIL_PROCESSED"

COMMIT;
```

### 8.2 New Table: `email_extractions`

```sql
email_extractions (
    id              UUID PRIMARY KEY,
    email_id         UUID REFERENCES emails(id) NOT NULL,
    
    -- The complete AI response, preserved for audit and learning
    ai_response      JSONB NOT NULL,
    
    -- Key extracted fields (indexed for querying)
    extracted_client_name    TEXT,
    extracted_client_id      UUID REFERENCES clients(id),
    extracted_bl_number      TEXT,
    extracted_container_nums TEXT[],
    extracted_eta            DATE,
    extracted_etd            DATE,
    
    -- Business classification
    business_category        TEXT,
    urgency                  TEXT,
    is_new_case              BOOLEAN,
    matched_case_id          UUID REFERENCES cases(id),
    match_confidence         FLOAT,
    
    -- Quality
    overall_confidence       FLOAT,
    extraction_version       TEXT DEFAULT '1.0',
    
    -- Broker feedback (learning loop)
    broker_corrections       JSONB,  -- What the broker changed
    broker_rating            SMALLINT, -- 1-5 rating of AI quality
    
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extractions_email ON email_extractions(email_id);
CREATE INDEX idx_extractions_bl ON email_extractions(extracted_bl_number);
CREATE INDEX idx_extractions_client ON email_extractions(extracted_client_id);
CREATE INDEX idx_extractions_case ON email_extractions(matched_case_id);
```

### 8.3 New Table: `suggested_updates`

When AI proposes changes with confidence < 0.85, they go here for broker review instead of being applied directly.

```sql
suggested_updates (
    id              UUID PRIMARY KEY,
    email_id         UUID REFERENCES emails(id),
    case_id          UUID REFERENCES cases(id),
    
    entity_type      TEXT,        -- 'case', 'case_item', 'document', etc.
    entity_id        UUID,        -- the specific entity to update
    field_name       TEXT,        -- which field
    suggested_value  JSONB,       -- what AI suggests
    confidence       FLOAT,       -- AI confidence
    
    status           TEXT DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED | MODIFIED
    reviewed_by      UUID REFERENCES users(id),
    actual_value     JSONB,       -- what the broker chose
    
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Why this table exists:** It separates "AI is confident enough to act" from "AI is suggesting but needs confirmation." The broker's attention feed only shows PENDING suggestions. The system never applies low-confidence changes silently.

---

## 9. Stage 7: Real-Time UI Updates

### 9.1 Server-Sent Events (SSE)

After the database transaction commits, the backend pushes an event to all connected browsers:

```
EVENT TYPE: "email_processed"

PAYLOAD:
{
  "email_id": "...",
  "notification": {
    "level": "INFO | WARNING | URGENT",
    "message": "📋 CB-2026-0045: 收到索尼发票和装箱单。原产地证待补。",
    "action_url": "/cases/uuid-of-CB-2026-0045",
    "action_label": "查看案件"
  },
  "attention_feed_update": {
    "new_items": 1,
    "total_items": 4
  },
  "case_updates": [
    {
      "case_id": "uuid-of-CB-2026-0045",
      "changes": ["documents_received", "status_change_suggested"]
    }
  ]
}
```

### 9.2 Frontend Behavior

```
ON RECEIVE "email_processed" EVENT:

1. If user is on DASHBOARD:
   → Animate new item appearing at top of attention feed
   → Update stat card counts
   → If URGENT: show toast notification with sound

2. If user is on CASE PAGE (matching case):
   → Live-update the document list
   → Live-update the timeline
   → Show subtle "新邮件已自动处理" indicator

3. If user is on ANY OTHER PAGE:
   → Update sidebar notification badge
   → If URGENT: show toast notification

4. NEVER: refresh the entire page or interrupt the broker's current action
```

---

## 10. Error Handling & Confidence Gates

### 10.1 Confidence Thresholds

```
CONFIDENCE-BASED BEHAVIOR:

Overall confidence >= 0.85:
  → Full auto-processing. All actions applied.
  → Item appears in "最近活动" (recent activity), not "需要处理"

Overall confidence 0.70-0.84:
  → Partial auto-processing. High-confidence fields applied.
  → Low-confidence fields go to suggested_updates.
  → Item appears in "需要处理" with 🟡 indicator.

Overall confidence < 0.70:
  → No automatic changes applied.
  → Everything goes to suggested_updates.
  → Item appears in "需要处理" with 🔴 indicator.
  → Broker MUST review before any database changes.

Overall confidence < 0.50:
  → Email is shown as "AI无法理解 — 需人工处理"
  → All extracted data is hidden (don't show bad guesses)
  → Broker processes manually.
```

### 10.2 Graceful Degradation

```
WHAT HAPPENS WHEN:

LLM API is down:
  → Email is ingested, stored, shown as "待AI处理"
  → When API recovers, Celery retries with exponential backoff
  → Broker CAN manually process (no blocking)

LLM API returns malformed JSON:
  → Retry once with stricter prompt
  → If still malformed: log error, mark as "AI处理失败"
  → Broker processes manually

LLM API timeout (>30 seconds):
  → Email shown as "AI处理中..."
  → Retry in background
  → Broker CAN manually process (don't make them wait)

OCR fails for attachment:
  → AI proceeds without that attachment's text
  → Document is shown as "OCR失败 — 无法自动提取"
  → Broker can view the document image inline

Email has no extractable content (image-only, encrypted):
  → Mark as "需人工查看"
  → Show in attention feed with 📎 indicator
```

### 10.3 Conflict Resolution

```
WHAT HAPPENS WHEN:

AI extraction conflicts with existing case data:
  → System compares confidences
  → If AI confidence > existing data source confidence: update
  → If AI confidence < existing data source confidence: keep existing
  → If both high confidence but different: flag as "数据冲突" for broker

AI says "new case" but B/L matched an existing case:
  → System overrides AI: link to existing case
  → Log: "AI suggested new case but B/L matched CB-XXXX"

Multiple emails processed simultaneously for same case:
  → Database row-level locking prevents race conditions
  → Second transaction sees updated state from first
```

---

## 11. Learning & Feedback Loop

### 11.1 Broker Correction Capture

```
WHEN BROKER CORRECTS AI:

1. System records the correction:
   - What field was changed
   - What AI suggested (old value)
   - What broker chose (new value)
   - Context: case type, product, client

2. Correction is stored in:
   - email_extractions.broker_corrections (JSONB)
   - A new feedback_examples table

3. After 10 similar corrections:
   → The system adjusts its behavior
   → For HS codes: the corrected code becomes the default
     for similar product descriptions
   → For client matching: the correction is remembered
```

### 11.2 Feedback Table

```sql
ai_feedback (
    id              UUID PRIMARY KEY,
    extraction_id   UUID REFERENCES email_extractions(id),
    
    -- What was corrected
    field_path      TEXT,        -- e.g., 'entities.products[0].hs_code'
    ai_value        JSONB,
    broker_value    JSONB,
    
    -- Context for learning
    context_snapshot JSONB,      -- The full AI input at the time
    
    -- Meta
    corrected_by    UUID REFERENCES users(id),
    correction_type TEXT,        -- 'CORRECTION', 'ACCEPTANCE', 'REJECTION'
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 11.3 Few-Shot Learning

```
HOW IT WORKS:

Before each AI call, the system checks:
1. Has this client sent similar emails before?
   → Include 2-3 examples of correctly-classified emails in the prompt
2. Has this product been classified before?
   → Include the previously-used HS code as context
3. Has this broker corrected the AI before on similar content?
   → Include the correction as context

This means the AI gets SMARTER over time, specific to this brokerage.
```

---

## 12. Edge Cases & Resilience

### 12.1 Forwarded Emails

```
SCENARIO: Client forwards a shipping notification from the carrier.

DETECTION:
- Subject starts with "Fwd:" or "转发:"
- Body contains "---------- Forwarded message ---------"
- Multiple From: addresses in the chain

HANDLING:
1. Extract the INNER email (the actual shipment notification)
2. Use THAT as the primary analysis target
3. The outer email (client's forwarding message) provides context
4. Sender of INNER email = the actual information source
5. Sender of OUTER email = who sent it to us (the client)

Example:
  Outer: 李经理 forwarded a DHL notification
  Inner: DHL says vessel delayed 3 days
  → System updates ETA on Sony's case
  → Sender context: 李经理 (client), Info source: DHL (carrier)
```

### 12.2 Multi-Language Emails

```
SCENARIO: Email is mixed Chinese + English.
  "Dear 张先生, please check the attached 发票 and 装箱单 for our July 进口 shipment."

HANDLING:
1. The AI prompt explicitly states: "The email may contain mixed Chinese and English."
2. Entity extraction works across both languages
3. Business terms are recognized in both languages:
   - "发票" = "Invoice"
   - "装箱单" = "Packing List"
   - "提单" = "Bill of Lading"
   - "进口" = "IMPORT"
   - "出口" = "EXPORT"
4. The AI returns both cn and en fields where applicable
```

### 12.3 Very Long Email Threads

```
SCENARIO: 25-email thread about a complex customs issue.

HANDLING:
1. Thread reconstruction provides last 10 emails
2. The CURRENT email is always analyzed fully
3. Previous emails are summarized (200 chars each)
4. If the AI determines the thread context is insufficient,
   it flags: "需要查看完整邮件链"
5. Broker can click to see the full thread
```

### 12.4 Emails with No Text (Image-Only)

```
SCENARIO: Email body is just an image (screenshot of a document).

HANDLING:
1. MIME parsing detects: body is image/*, no text/plain part
2. Image is sent to OCR (PaddleOCR, on-premise)
3. OCR text becomes the email body for AI analysis
4. Email is flagged: "图片邮件 — OCR识别后处理"
5. If OCR confidence is low: "AI识别准确度较低，建议人工查看原图"
6. Original image is preserved in documents
```

### 12.5 WeChat Screenshots

```
SCENARIO: Client takes a screenshot of a WeChat conversation and emails it.

HANDLING:
1. OCR extracts text from the screenshot
2. AI analyzes: this is forwarded communication, not a direct email
3. Metadata extraction is less confident (screenshots are lossy)
4. Flag: "微信截图 — 信息可能不完整"
5. If possible, suggest: "建议请客户转发原始文件而非截图"
```

### 12.6 Spam and Phishing Detection

```
SCENARIO: Email that looks like customs but is actually phishing.

DETECTION:
1. Sender domain analysis:
   - Real customs: @customs.gov.cn
   - Phishing: @customs-gov.cn, @customs.xyz
2. AI prompt includes: "如果是可疑邮件，标记为SPAM并说明原因"
3. Urgency manipulation detection:
   - "URGENT!!! Click here immediately!!!"
   → Flag as suspicious
4. Never auto-click links or auto-download from suspicious emails
```

---

## Summary: What the Email Engine Delivers

| Before (Manual) | After (AI Engine) |
|----------------|-------------------|
| Broker reads every email | AI processes every email; broker only sees items needing human judgment |
| Manual case creation (15 fields) | AI auto-creates cases from emails with all fields pre-filled |
| Manual document-to-case linking | AI auto-links using B/L, container, client matching |
| Remembering deadlines | AI extracts all deadlines, calculates absolute dates, creates tasks |
| Typing product details from invoice | AI extracts all line items, quantities, values from OCR |
| Looking up HS codes | AI suggests codes with reasoning; learns from broker corrections |
| Checking what documents are missing | AI cross-references received vs. required docs |
| Determining if this is a new case or update | AI classifies the business event |
| Reading long email threads for context | AI reconstructs thread and extracts the key change |
| Worrying about data entry errors | AI cross-validates across documents and flags discrepancies |

**The email engine is not a feature.** It is the operating system. Every email is a business event. The system understands the event and acts on it. The broker supervises.
