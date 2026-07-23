# Dashboard: AI Workbench — Complete Design

**Status:** Design Document
**Inspiration:** Linear, Notion, Apple
**Principles:** Minimal. Clean. Fast. Calm. Never clutter. Never decorate data. Every pixel earns its place.

---

## Table of Contents

1. [Anti-Principles: What We Do NOT Build](#1-anti-principles)
2. [The Workbench Layout](#2-the-workbench-layout)
3. [Section 1: AI Daily Briefing](#3-section-1-ai-daily-briefing)
4. [Section 2: Needs Attention](#4-section-2-needs-attention)
5. [Section 3: Waiting](#5-section-3-waiting)
6. [Section 4: Upcoming Deadlines](#6-section-4-upcoming-deadlines)
7. [Section 5: Recently Cleared](#7-section-5-recently-cleared)
8. [The Command Bar (⌘K)](#8-the-command-bar)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Sidebar: Minimal Mode](#10-sidebar-minimal-mode)
11. [Empty, Loading & Error States](#11-empty-loading--error-states)
12. [Typographic System](#12-typographic-system)
13. [Motion Design](#13-motion-design)

---

## 1. Anti-Principles: What We Do NOT Build

```
❌ No stat cards (no "23 active cases" boxes competing for attention)
❌ No pie charts, bar charts, donut charts (this is a workbench, not a report)
❌ No multi-column dashboard grid (one feed, one scroll)
❌ No "recent activity" widget (that's noise — the timeline is on the case page)
❌ No "quick actions" button row (⌘K handles everything faster)
❌ No calendar widget taking up space (deadlines are a list, not a calendar)
❌ No data that doesn't demand action (if it's informational, it's collapsed)
❌ No colors that don't convey meaning (grayscale by default, red/amber for urgency)
❌ No loading spinners that block the entire page (skeleton text, progressive loading)
```

### Why These Are Banned

A traditional dashboard says: "Here's everything. Find what matters."  
The AI Workbench says: "Here's what matters. Everything else is one keystroke away."

Every widget, chart, and stat card on a traditional dashboard is the designer admitting they don't know what the user actually needs. So they show everything. The AI Workbench knows what needs attention and shows only that. The rest is accessible via ⌘K, not via widgets.

---

## 2. The Workbench Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ○ ○ ○  HARBOR                                            ⌘K   🔔  张   │
│  ─────────────────────────────────────────────────────────────────────── │
│  ▸ ▸     Good morning, 张三                             Monday, 7/21    │
│                                                                          │
│  ▸ ▸     ┌──────────────────────────────────────────────────────────┐   │
│  ▸ ▸     │                                                          │   │
│  ▸ ▸     │  ⚡ Good morning.                                        │   │
│  ▸ ▸     │                                                          │   │
│  ▸ ▸     │  3 cases need your attention today:                      │   │
│  ▸ ▸     │  CB-0045 has a customs query due today.                  │   │
│  ▸ ▸     │  CB-0048 is a new case ready for your review.            │   │
│  ▸ ▸     │  CB-0041 has a low-confidence HS code to verify.         │   │
│  ▸ ▸     │                                                          │   │
│  ▸ ▸     │  2 deadlines today. 5 cases are waiting.                 │   │
│  ▸ ▸     │  CB-0036 and CB-0037 cleared last week.                  │   │
│  ▸ ▸     │                                                          │   │
│  ▸ ▸     └──────────────────────────────────────────────────────────┘   │
│  ▸ ▸                                                                     │
│  ▸ ▸     NEEDS ATTENTION                                                 │
│  ▸ ▸                                                                     │
│  ▸ ▸     ┌──────────────────────────────────────────────────────────┐   │
│  ▸ ▸     │ 🔴  CB-0045 · Sony Electronics · Customs Query           │   │
│  ▸ ▸     │     Respond by today · 海关要求补充原产地证                │   │
│  ▸ ▸     │     [Respond →]                        UNDER_REVIEW      │   │
│  ▸ ▸     └──────────────────────────────────────────────────────────┘   │
│  ▸ ▸                                                                     │
│  ▸ ▸     ┌──────────────────────────────────────────────────────────┐   │
│  ▸ ▸     │ 🟡  CB-0048 · Toshiba Electronic · New Case (AI draft)   │   │
│  ▸ ▸     │     6 items · HS codes 92% confidence · Ready for review │   │
│  ▸ ▸     │     [Review →]                                  DRAFT    │   │
│  ▸ ▸     └──────────────────────────────────────────────────────────┘   │
│  ▸ ▸                                                                     │
│  ▸ ▸     ┌──────────────────────────────────────────────────────────┐   │
│  ▸ ▸     │ 🟡  CB-0041 · Mitsubishi Electric · HS Code Review       │   │
│  ▸ ▸     │     PA-200 Amplifier · AI confidence 78%                 │   │
│  ▸ ▸     │     [Review →]                             PREPARING     │   │
│  ▸ ▸     └──────────────────────────────────────────────────────────┘   │
│  ▸ ▸                                                                     │
│  ▸ ▸     WAITING — 5 cases                                              │
│  ▸ ▸                                                                     │
│  ▸ ▸     CB-0052  Fujitsu         Awaiting B/L          ETA Jul 28  │   │
│  ▸ ▸     CB-0050  Hitachi         Awaiting COO         ETA Aug 2   │   │
│  ▸ ▸     CB-0042  NEC             Under review          7 days      │   │
│  ▸ ▸     CB-0039  Panasonic       Under review          3 days      │   │
│  ▸ ▸     CB-0035  Sharp           Inspection            2 days      │   │
│  ▸ ▸                                                                     │
│  ▸ ▸     UPCOMING DEADLINES                                             │
│  ▸ ▸                                                                     │
│  ▸ ▸     Today    CB-0045  Customs query deadline              URGENT│   │
│  ▸ ▸     Today    CB-0038  Duty payment due                   URGENT│   │
│  ▸ ▸     Tomorrow CB-0041  COO expected from client          WARNING│   │
│  ▸ ▸     Jul 24   CB-0048  ETA (T-7 reminder)                  INFO │   │
│  ▸ ▸     Jul 28   CB-0052  ETA                                 INFO │   │
│  ▸ ▸                                                                     │
│  ▸ ▸     RECENTLY CLEARED                                               │
│  ▸ ▸                                                                     │
│  ▸ ▸     ✅ CB-0036 · Toyota  · Cleared Jul 19                         │
│  ▸ ▸     ✅ CB-0037 · Honda   · Cleared Jul 18                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

  ○ ○ ○ = collapsed sidebar (icons only, no labels)
  ▸ ▸   = content region padding
```

### Spatial Rules

```
- Content max-width: 720px (not full-width — readability over density)
- Content centered with generous left/right margins
- Section spacing: 40px between sections
- Item spacing: 8px between items within a section
- The side margins are NOT wasted space — they are breathing room
  that makes the content feel calm, not crowded
```

---

## 3. Section 1: AI Daily Briefing

### What It Is

A 4-5 line AI-generated summary at the top of the page. Updated every morning at 8:00 AM and whenever the broker returns after 4+ hours away. Written in natural Chinese. Brief. Warm. Direct.

### Design

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⚡ Good morning.                                            │
│                                                              │
│  3 cases need your attention today:                          │
│  CB-0045 has a customs query due today.                      │
│  CB-0048 is a new case ready for your review.                │
│  CB-0041 has a low-confidence HS code to verify.             │
│                                                              │
│  2 deadlines today. 5 cases are waiting.                     │
│  CB-0036 and CB-0037 cleared last week.                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Variations by Time of Day

```
Morning (before 12:00):
  "Good morning, 张三."

Afternoon (12:00-18:00):
  "Good afternoon, 张三. Here's where things stand."

Evening (after 18:00):
  "Good evening, 张三. Before you wrap up:"

Returning after 4+ hours:
  "Welcome back. While you were away:
   2 new emails processed. 1 case advanced to UNDER_REVIEW.
   CB-0045 still needs your response — due today."
```

### Variations by Urgency

```
All clear:
  "⚡ Good morning. Nothing urgent today.
   5 cases on track. Next deadline: CB-0052 ETA on Jul 28."

Something urgent:
  "⚡ Good morning.
   ⚠️ 1 case needs immediate attention:
   CB-0045 customs query — respond by today."

Multiple urgent:
  "⚡ Good morning.
   🔴 3 urgent items today. Start with CB-0045 —
   customs query due by 5PM."
```

### AI Logic (how the briefing is generated)

```
FUNCTION generate_daily_briefing(broker_id):
    
    urgent_items = get_items_needing_attention(broker_id)
    deadlines_today = get_deadlines_for_date(TODAY)
    waiting_cases = get_cases_in_waiting_stages()
    recently_cleared = get_cases_cleared_since(LAST_LOGIN)
    
    IF urgent_items is empty AND deadlines_today is empty:
        RETURN all_clear_message()
    
    briefing = ""
    
    IF urgent_items has items:
        briefing += f"{urgent_items.length} cases need your attention today:\n"
        FOR EACH item in urgent_items (max 3):
            briefing += f"{item.case_no} — {item.reason}\n"
    
    IF deadlines_today has items:
        briefing += f"\n{deadlines_today.length} deadlines today.\n"
    
    IF waiting_cases has items:
        briefing += f"{waiting_cases.length} cases are waiting.\n"
    
    IF recently_cleared has items:
        briefing += f"\n{recently_cleared[0].case_no} and {recently_cleared[1].case_no} cleared recently.\n"
    
    RETURN briefing
```

### Visual Treatment

```
- Background: subtle warm tint (bg-amber-50/30) — feels like morning light
- No border, no shadow, no card — it's part of the page
- Font: 15px, line-height 1.6, text-gray-700
- "Good morning" in a slightly larger weight (font-semibold)
- The ⚡ emoji is the only decoration
- Fades slightly after the broker scrolls past it (opacity transition)
```

---

## 4. Section 2: Needs Attention

### What It Is

The prioritized list of items that require the broker to DO something. This is the most important section on the page. Everything else is secondary.

### Sorting Rule

```
Items are sorted by: URGENCY > DEADLINE PROXIMITY > AGE

1. URGENT items with hard deadlines today → TOP
2. URGENT items without hard deadlines
3. HIGH priority items
4. NORMAL items by deadline proximity
5. New items (unreviewed by broker)
```

### Item Types & Their Cards

Each card is one row — not a box. Minimal, scannable. The broker should be able to scan 10 items in 5 seconds.

```
TYPE 1: CUSTOMS QUERY (urgent, hard deadline)

🔴  CB-0045 · Sony Electronics · Customs Query
     Respond by today · 海关要求补充原产地证
     [Respond →]                                    UNDER_REVIEW

    ─── Design notes:
    🔴 = red circle, 8px. Only URGENT items get this.
    Case number in font-mono, font-semibold
    Client name in text-gray-500
    One-line description: what happened + what's needed
    Right-aligned: current case stage (muted badge)
    [Respond →] is the primary action — keyboard shortcut: Enter


TYPE 2: NEW AI-DRAFTED CASE (needs review)

🟡  CB-0048 · Toshiba Electronic · New Case (AI draft)
     6 items · HS codes 92% confidence · Ready for review
     [Review →]                                            DRAFT

    ─── Design notes:
    🟡 = amber circle. "Hey, look at this, but not an emergency."
    Shows AI confidence summary so broker knows what to expect
    [Review →] opens the case detail, focused on the AI suggestions


TYPE 3: LOW-CONFIDENCE AI EXTRACTION (needs human judgment)

🟡  CB-0041 · Mitsubishi Electric · HS Code Review
     PA-200 Amplifier · AI confidence 78% · Alternatives available
     [Review →]                                       PREPARING

    ─── Design notes:
    Shows the specific item that needs review
    "Alternatives available" = the AI has other suggestions


TYPE 4: STALLED CASE (no activity for 5+ days)

🟠  CB-0033 · Canon · Stalled — 7 days in COLLECTING_DOCUMENTS
     Missing: Certificate of Origin, Import Permit
     [View →]                              COLLECTING_DOCUMENTS

    ─── Design notes:
    🟠 = orange circle. Not urgent, but shouldn't be forgotten.
    Shows what's blocking progress.


TYPE 5: MANUAL BROKER REMINDER

🔵  ✋ Call Mr. Wang about the permit renewal
     Created by you · Due tomorrow
     [Done] [Snooze] [Edit]

    ─── Design notes:
    🔵 = blue circle. Manual reminders are distinct from auto.
    ✋ icon = manual reminder indicator
    Multiple action buttons because manual reminders are flexible
```

### Interaction Design

```
HOVER: subtle background highlight (bg-gray-50)
       action button appears (hidden by default for cleanliness)
       
CLICK: navigates to the case page OR executes the primary action
       (configurable per item type)

KEYBOARD:
  ↑ ↓   navigate between items
  Enter  execute primary action (open case, review, respond)
  Space  quick-preview (expand item inline without navigating)
  D      dismiss item (remove from feed)
  S      snooze item
  ⌘↵    open case in new tab
```

---

## 5. Section 3: Waiting

### What It Is

Cases where the broker's next action is blocked — waiting for a document, waiting for customs, waiting for a client response. The broker cannot DO anything about these right now. They just need to KNOW about them.

### Design Principle: Compact Rows

```
These are NOT action items. They should not compete visually with
the "Needs Attention" section. They are reference information —
compact, muted, scannable.

WAITING — 5 cases                                    [collapse ▾]

CB-0052  Fujitsu         Awaiting B/L          ETA Jul 28    3d
CB-0050  Hitachi         Awaiting COO         ETA Aug 2     8d
CB-0042  NEC             Under review          7 days         —
CB-0039  Panasonic       Under review          3 days         —
CB-0035  Sharp           Inspection            2 days         —
```

### Column Meanings

```
Case No    Client        Why waiting           Next milestone    Stalled?
────────   ───────────   ───────────────────   ──────────────   ───────
CB-0052    Fujitsu       Awaiting B/L          ETA Jul 28        3d
                                                            (3 days waiting,
                                                             no activity)

The "Stalled?" column only shows when > 3 days. Otherwise blank.
This prevents visual noise for recently-waiting cases.
```

### Collapse Behavior

```
- Default: EXPANDED (broker needs to know what's waiting)
- Can be collapsed: [▾] → [▸] WAITING — 5 cases
- Collapsed state shows just the count
- Preference is remembered per user
- On mobile: always collapsed
```

### Zero State

```
When no cases are waiting (rare, but possible):

WAITING — 0 cases

All cases are actively progressing. Nothing is blocked. 🎉
```

---

## 6. Section 4: Upcoming Deadlines

### What It Is

A timeline of approaching milestones. NOT a calendar. A scannable list ordered by date, closest first.

### Design

```
UPCOMING DEADLINES

Today    🔴 CB-0045  Customs query deadline              URGENT
Today    🔴 CB-0038  Duty payment due                    URGENT
Tomorrow 🟡 CB-0041  COO expected from client           WARNING
Jul 24   🔵 CB-0048  ETA (T-7 reminder)                   INFO
Jul 28   🔵 CB-0052  ETA                                   —
Jul 30   🔵 CB-0050  Customs review — 14 days           WARNING
Aug 02   ○  CB-0050  ETA                                   —

Showing next 7 days · [Show all 23 upcoming →]
```

### Visual Hierarchy

```
TODAY'S DEADLINES:
  → Full visibility. Red indicator. URGENT label.
  → These also appear in the "Needs Attention" section above.
  → Yes, they're shown twice. This is intentional — the Deadline section
    is a complete timeline. The Needs Attention section is actionable.

TOMORROW:
  → Amber indicator. WARNING label.
  → Shown because 24 hours is not a lot of time.

WITHIN 7 DAYS:
  → Blue indicator or no indicator (INFO/neutral).
  → Shown for awareness. Not actionable yet.

BEYOND 7 DAYS:
  → Hidden behind "Show all" link.
  → Don't crowd the view with distant deadlines.

PAST DUE:
  → ALWAYS at the top. Red. CRITICAL label.
  → These should also be in Needs Attention.
```

### The "Show All" View

```
When broker clicks "Show all 23 upcoming →":

→ Page transitions to a full timeline view (still minimal)
→ Grouped by: Overdue / This Week / Next Week / This Month / Later
→ Each group has a subtle header
→ Back button or ⌘[ to return to workbench

This is NOT a separate page — it's an expanded state of the
same section, rendered inline with a smooth height transition.
```

---

## 7. Section 5: Recently Cleared

### What It Is

A small, satisfying list of recently completed cases. Provides closure and a sense of progress. Collapsed by default after 3 items.

### Design

```
RECENTLY CLEARED

✅ CB-0036 · Toyota  · Import · Cleared Jul 19
✅ CB-0037 · Honda   · Export · Cleared Jul 18

This week: 4 cases cleared
```

### Why This Section Exists

```
Psychological: Seeing completed work reduces anxiety about
outstanding work. The broker sees that things ARE getting done.

Practical: Quick access to recently-completed cases if a client
calls with a follow-up question.

The "This week: X cases cleared" line gives a sense of velocity
without being a "productivity metric." No targets. No charts.
Just "here's what got done."
```

---

## 8. The Command Bar (⌘K)

### What It Is

A spotlight-style command bar that is the universal entry point for navigation, search, and creation. Inspired by Linear's ⌘K, Apple's Spotlight, Notion's Quick Find.

### Trigger

```
Press ⌘K anywhere in the app → command bar opens

Or click the "⌘K" button in the header (for mouse users)
```

### Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🔍  Type a command or search...                ⌘K  │   │
│   │ ─────────────────────────────────────────────────── │   │
│   │                                                     │   │
│   │  SUGGESTIONS                                        │   │
│   │                                                     │   │
│   │  →  Go to CB-0045 · Sony Electronics               │   │
│   │  →  Search "invoice August"                        │   │
│   │  →  Create new case                                │   │
│   │  →  Add manual reminder                            │   │
│   │                                                     │   │
│   │  RECENT                                            │   │
│   │                                                     │   │
│   │  📋 CB-0048 · Toshiba Electronic                   │   │
│   │  📋 CB-0041 · Mitsubishi Electric                  │   │
│   │  👤 李经理 · Sony Electronics                      │   │
│   │  📧 海关查询 — 索尼音响                             │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   (translucent backdrop blurs the workbench behind)         │
└─────────────────────────────────────────────────────────────┘
```

### What ⌘K Can Do

```
NAVIGATE:
  "CB-0045"         → Open case
  "sony"            → Show Sony's cases
  "invoice"         → Search all documents
  "client 李经理"    → Open client profile

CREATE:
  "new case"        → Open case creation (AI-pre-filled from latest email)
  "new reminder"    → Quick reminder creation
  "new client"      → Add new client

ACTIONS:
  "submit CB-0045"  → Go to case, focus on submit button
  "dismiss all"     → Dismiss all non-urgent feed items
  "toggle sidebar"  → Collapse/expand sidebar

SEARCH:
  Anything that doesn't match a command → full-text search
  across cases, clients, documents, emails

INTELLIGENCE:
  "what's urgent?"  → Focus on urgent items
  "show waiting"    → Jump to Waiting section
  "deadlines today" → Filter deadlines to today
  "summary"         → Show AI briefing again
```

### Zero-Query State

```
When ⌘K opens without a query:

→ Show 5-8 recent items (cases viewed, clients accessed)
→ Show quick actions (new case, new reminder)
→ Show the current date/time subtly

This is "where am I and what was I doing?" — not a blank search box.
```

---

## 9. Keyboard Shortcuts

```
GLOBAL:
  ⌘K         Open command bar
  ⌘[         Back (go to previous page)
  ⌘]         Forward
  ⌘\         Toggle sidebar
  ⌘N         New case (from latest email context)
  ⌘⇧N        New manual reminder
  ⌘F         Focus search (within current context)
  Esc        Close modal / dismiss command bar / go to workbench

WORKBENCH FEED:
  ↑ ↓        Navigate between items
  Enter      Open selected item
  Space      Expand item inline (preview)
  D          Dismiss selected item
  S          Snooze selected item
  1-5        Jump to section (1=Needs Attention, 2=Waiting, etc.)
  R          Refresh / recalculate AI briefing

CASE PAGE:
  ⌘Enter     Primary action (Submit, Confirm, etc.)
  ⌘⇧E        Edit case
  ⌘⇧D        Add document
  Esc        Back to workbench
```

---

## 10. Sidebar: Minimal Mode

### Default: Collapsed (Icons Only)

```
┌────┐
│    │
│ 📊 │  ← Workbench (active)
│    │
│ 📋 │  ← Cases
│    │
│ 👥 │  ← Clients
│    │
│ ⚙  │  ← Settings
│    │
└────┘

  Width: 52px
  Icons: 24px, centered
  Active: subtle background highlight (bg-harbor-50)
  Hover: tooltip appears with label
```

### Expanded (On Hover or ⌘\)

```
┌──────────────┐
│ H  Harbor    │
│ ──────────── │
│ 📊 Workbench │
│ 📋 Cases     │
│ 👥 Clients   │
│ ⚙  Settings  │
└──────────────┘

  Width: 200px
  Expands with a smooth slide animation (200ms, ease-out)
  Pushes content right (no overlay)
  Stays expanded while mouse is in sidebar area
  Auto-collapses after mouse leaves + 500ms delay
```

### What's NOT in the Sidebar

```
The sidebar does NOT have:
  ❌ Email inbox link (emails are absorbed into cases)
  ❌ Tasks link (tasks are absorbed into the workbench feed)
  ❌ Search link (search is ⌘K, always available)
  ❌ Reports link (reports are generated on demand via ⌘K)
  ❌ Count badges (no "23 cases" badge — that adds anxiety)
  ❌ Notification count (the 🔔 in the header handles this)
```

---

## 11. Empty, Loading & Error States

### 11.1 First Launch (No Cases, No Data)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│            🚢                                                │
│                                                              │
│         Welcome to Harbor                                    │
│                                                              │
│    Your AI customs brokerage workbench.                      │
│                                                              │
│    To get started:                                           │
│                                                              │
│    → Connect your email (Settings → Email)                   │
│      Harbor will automatically create cases from             │
│      incoming shipment emails.                               │
│                                                              │
│    → Or create your first case manually                      │
│                                                              │
│              [Connect Email]  [Create Case]                  │
│                                                              │
│    Press ⌘K anytime to search or run a command.              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Loading State

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⚡ Good morning.                                            │
│                                                              │
│  ────────────────────────                                    │
│  ─────────────                                              │
│  ───────────────────────────────                             │
│                                                              │
│  NEEDS ATTENTION                                             │
│                                                              │
│  ○  ───────────────────────────────                          │
│  ○  ───────────────────────────                              │
│  ○  ──────────────────────────────                           │
│                                                              │
│  WAITING                                                     │
│                                                              │
│  ─────────  ────────  ────────────  ────────                 │
│  ─────────  ────────  ────────────  ────────                 │
│  ─────────  ────────  ────────────  ────────                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘

  Skeleton text, not spinners.
  The page structure is visible immediately.
  Content fills in progressively as data loads.
  Nothing janks or shifts after initial paint.
```

### 11.3 Error State

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⚡ Having trouble loading your workbench.                   │
│                                                              │
│  The server might be temporarily unavailable.               │
│  Your data is safe.                                          │
│                                                              │
│              [Try Again]  [Work Offline]                     │
│                                                              │
│  Offline mode: view cached cases and documents.              │
│  New emails will be processed when connection returns.       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Typographic System

### Font Stack

```
Font: system font stack (matches the OS)
  macOS: -apple-system, SF Pro Display
  Windows: Segoe UI
  Chinese: PingFang SC, Microsoft YaHei

Monospace (case numbers, B/L numbers, HS codes):
  SF Mono, Menlo, Consolas
```

### Type Scale

```
12px  — metadata, timestamps, labels (text-gray-400)
13px  — secondary text, descriptions (text-gray-500)
14px  — body text, item titles (text-gray-700)
15px  — briefing text (text-gray-700)
16px  — section headers (text-gray-900, font-semibold)
20px  — page title (not shown — the briefing IS the title)
```

### Color Palette

```
TEXT:
  text-gray-900  — primary content
  text-gray-700  — body text
  text-gray-500  — secondary, descriptions
  text-gray-400  — metadata, timestamps
  text-gray-300  — disabled, placeholder

BACKGROUND:
  bg-white       — page background
  bg-gray-50     — hover state
  bg-amber-50/30 — briefing section background (morning light)

ACCENTS (used sparingly):
  red-500        — urgent items (dot, label)
  amber-500      — warning items (dot, label)
  blue-500       — info items (dot, label)
  green-500      — success, cleared (checkmark)
  harbor-600     — interactive elements (links, buttons)

BORDERS:
  border-gray-100 — subtle separators
  No heavy borders. No card shadows.
```

---

## 13. Motion Design

### Principles

```
- Animations are fast (150-200ms). Never slow.
- Animations serve function. Never decoration.
- No bounce. No spring. Ease-out for entrances, ease-in for exits.
- Reduced motion: all animations disabled when
  prefers-reduced-motion is set.
```

### Specific Animations

```
1. PAGE LOAD:
   → Briefing fades in (opacity 0→1, 300ms)
   → Sections stagger in (each 50ms delay, opacity + translateY 4px→0)

2. NEW ITEM APPEARING (SSE push):
   → Item slides in from top (translateY -20px→0, opacity 0→1, 200ms)
   → Brief amber highlight pulse on the new item (bg-amber-50 → transparent, 1s)
   → Other items shift down smoothly (transition-all)

3. ITEM DISMISSAL:
   → Item fades out and collapses height (opacity 1→0, max-height → 0, 150ms)
   → Items below slide up to fill gap

4. SECTION COLLAPSE:
   → Height transition (max-height, 200ms ease-out)
   → Content fades out during collapse

5. COMMAND BAR:
   → Backdrop: opacity 0→1 (100ms)
   → Dialog: scale 0.97→1 + opacity 0→1 (150ms, ease-out)
   → Results appear with 30ms stagger

6. SIDEBAR EXPAND:
   → Width transition (52px → 200px, 200ms, ease-out)
   → Labels fade in (opacity 0→1, 150ms, delayed 50ms)
```

---

## Summary

### Before (Traditional Dashboard)
```
Stat cards → Status chart → Recent activity widget → Quick actions row
→ Deadlines widget → A wall of information demanding the broker figure
out what matters.
```

### After (AI Workbench)
```
⚡ Briefing (AI tells you what matters today)
│
├── NEEDS ATTENTION (3 actionable items, one per row)
│
├── WAITING (5 cases, compact reference rows)
│
├── UPCOMING DEADLINES (7-day timeline)
│
└── RECENTLY CLEARED (closure + velocity)
```

One scroll. No decisions. No clutter. Press ⌘K for everything else.

The broker opens Harbor, reads the briefing, handles the 3 attention items, skims the rest, and gets back to work. Total time: under 2 minutes.
