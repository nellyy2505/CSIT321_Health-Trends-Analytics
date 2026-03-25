# CareData Platform — Comprehensive Description

---

## 1. Project Requirements

### 1.1 Project Vision Statement

CareData is a **clinical governance platform for Australian residential aged care facilities**, aligned to the AIHW Quality Indicator Program Manual 4.0. It replaces fragmented spreadsheet-based QI tracking with a unified web portal that ingests quarterly QI collection data, computes prevalence rates across 14 indicator categories, benchmarks facility performance against national medians, and introduces AI-powered voice biomarker screening for early detection of cognitive and physical decline in residents.

### 1.2 Problem Statement

Aged care facilities currently manage Quality Indicator reporting through manual CSV compilation, ad-hoc spreadsheets, and disconnected government submission portals. Directors of Nursing (DON) lack a single view of facility performance. There is no mechanism to detect early signs of resident deterioration between quarterly assessment windows. The Royal Commission into Aged Care Quality and Safety highlighted systemic failures in monitoring — particularly around restrictive practices, medication management, and timely clinical escalation. CareData addresses these gaps by providing real-time dashboards, automated GPMS form population, trend analysis, and a novel voice biomarker screening module.

### 1.3 Stakeholders & Users

| Role | Description | Platform Access |
|------|-------------|----------------|
| **Director of Nursing (DON)** | Primary decision-maker; accountable for facility QI performance | Full access: Dashboard, Reports, Benchmarking, Voice Dashboard, Settings |
| **Quality Manager** | Prepares QI submissions, monitors compliance | Full access: Data Entry, QI Reports, GPMS forms, Benchmarking |
| **Registered Nurse** | Frontline care; generates voice screening links, acknowledges alerts | Dashboard, Voice Dashboard, Data Entry |
| **Aged Care Quality & Safety Commission Auditor** | External; reviews QI reports and GPMS submissions | Read-only reports (export/PDF) |
| **Resident** | Aged care resident who records voice samples | Voice Record page only (elderly-accessible, minimal UI) |
| **Facility Administrator** | Manages facility profile, user accounts, data retention | Settings page |

### 1.4 Functional Requirements

| ID | Requirement | Module | Status |
|----|-------------|--------|--------|
| FR-01 | User registration with email/password and Google OAuth | Auth | Implemented |
| FR-02 | JWT-based session management (7-day expiry, HS256) | Auth | Implemented |
| FR-03 | Upload quarterly QI CSV data (up to 5 MB, 250+ residents) | Data Entry | Implemented |
| FR-04 | Auto-parse CSV into 14 QI category aggregates with traffic-light status | Data Entry | Implemented |
| FR-05 | Display 14-category QI dashboard with trend arrows and summary strip | Dashboard | Implemented |
| FR-06 | Compute GPMS government submission fields from CSV data | Data Entry | Implemented |
| FR-07 | Manual GPMS form entry with 13 collapsible sections | Data Entry | Implemented |
| FR-08 | Quarter-over-quarter trend analysis for each QI category | Reports | Implemented |
| FR-09 | Resident-level drill-down (de-identified by access level) | Reports | Implemented |
| FR-10 | Facility vs AIHW national median benchmarking | Benchmarking | Implemented |
| FR-11 | Facility profile management (name, ABN, bed capacity, contacts) | Settings | Implemented |
| FR-12 | Generate time-limited voice recording links (7-day expiry) | Voice | Implemented |
| FR-13 | Batch link generation for multiple residents | Voice | Implemented |
| FR-14 | Resident self-registration and login via recording link | Voice | Implemented |
| FR-15 | Browser-based voice recording (WAV, max 60s, 3 prompt types) | Voice | Implemented |
| FR-16 | Acoustic feature extraction (speech rate, pauses, pitch, jitter, shimmer, spectral centroid) | Voice | Implemented |
| FR-17 | Baseline comparison and deviation scoring (green/amber/red) | Voice | Implemented |
| FR-18 | AI-generated clinical narrative per voice analysis | Voice | Implemented |
| FR-19 | Whisper transcription of voice recordings | Voice | Implemented |
| FR-20 | Voice biomarker alerts feed with acknowledge workflow | Voice | Implemented |
| FR-21 | QI flag integration (voice biomarkers mapped to QI categories) | Voice | Implemented |
| FR-22 | Health record image analysis via OpenAI Vision (gpt-4o-mini) | Health Scan | Implemented |
| FR-23 | AI-generated health recommendations (actions, diet, exercise, risks) | Health Scan | Implemented |
| FR-24 | Resident consent management (grant/withdraw) | Voice | Implemented |
| FR-25 | Exportable HTML voice analysis report | Voice | Implemented |
| FR-26 | Residents-at-risk flagging (>=2 indicators triggered simultaneously) | Dashboard | Implemented |
| FR-27 | CSV upload history with download and delete | Data Entry | Implemented |

### 1.5 Non-Functional Requirements

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-01 | Response time <2s for dashboard load | FastAPI async + Azure Table Storage indexed by PartitionKey |
| NFR-02 | Support 250+ residents per CSV upload | Batch Azure transactions (100 entities/batch), streaming CSV parse |
| NFR-03 | Accessible voice recording UI for elderly residents | Large fonts, high contrast, minimal UI, 4-character password |
| NFR-04 | CORS restricted to registered origins | Whitelist: localhost:5173, CloudFront, Netlify |
| NFR-05 | Password security (bcrypt hashing, 8+ char requirement) | passlib[bcrypt], strength indicator on registration |
| NFR-06 | Graceful degradation without Azure | In-memory fallback for all 11 database services |
| NFR-07 | Graceful degradation without OpenAI | Template-based narrative fallback, empty recommendations |
| NFR-08 | Mobile-responsive layout | Tailwind responsive classes, hamburger nav on sm breakpoint |
| NFR-09 | Browser compatibility | Chrome, Firefox, Safari (last 1 version each) |

### 1.6 Requirement Change Log

- **AWS to Azure migration**: Replaced Cognito auth with JWT, DynamoDB with Azure Table Storage
- **QI categories expanded**: 9 to 14 categories to match AIHW QI Program Manual 4.0
- **Voice biomarker module added**: Phase 2 addition — not in original scope
- **Health Scan deprioritised**: OpenAI Vision scan moved to legacy; QI dashboard is now primary
- **GPMS integration added**: Government submission form auto-population from CSV

---

## 2. Information Architecture

### 2.1 Site Map

```
CareData Portal
├── Public Pages
│   ├── / (Landing Page — Hero, Features, Indicators, Why Choose Us)
│   ├── /login (Email + Google OAuth)
│   ├── /register (With password strength indicator)
│   ├── /about, /contact, /privacy, /terms
│   └── /voice/record/:token (Resident recording — token-authenticated)
│
├── Authenticated Pages (Nurse/DON)
│   ├── /dashboard (QI Dashboard — 14 traffic-light cards, trends, radar)
│   ├── /upload-csv (Data Entry — CSV upload + GPMS manual form)
│   ├── /uploaded-history (Upload history — view, download, delete)
│   ├── /reports (QI Reports — per-category drill-down, resident detail)
│   ├── /benchmarking (Facility vs national AIHW medians)
│   ├── /voice/dashboard (Voice Analytics — alerts, link gen, resident table)
│   ├── /settings (Facility profile, benchmarks, data retention)
│   ├── /health-scan (Legacy — image analysis)
│   ├── /mydata (Legacy — health data viewer)
│   └── /documentation (Help docs)
│
└── Resident Pages (Resident token-authenticated)
    ├── /voice/record/:token (Recording interface)
    └── /voice/portal (Recording history, playback)
```

### 2.2 Key User Tasks

| Task | User | Flow |
|------|------|------|
| Upload quarterly QI data | Quality Manager | Upload CSV → system parses 14 categories → dashboard populates → GPMS fields auto-computed |
| Review facility performance | DON | Dashboard → 14 traffic-light cards → click category → trend chart + severity breakdown |
| Benchmark against national | DON | Benchmarking → side-by-side bar charts → facility rate vs AIHW median with percentile |
| Generate voice screening link | Nurse | Voice Dashboard → enter resident ID → Generate Link → copy URL → share with resident |
| Record voice sample | Resident | Open link → register/login → consent → see prompt → record → upload |
| Review voice alerts | Nurse | Voice Dashboard → Alerts Feed → view narrative + risk scores → Acknowledge |
| Submit GPMS form | Quality Manager | Data Entry → GPMS tab → 13 sections auto-filled from CSV → review → Submit |
| Identify at-risk residents | Nurse | Dashboard → Residents at Risk section → see residents with >=2 QI flags |
| Generate QI report | Quality Manager | Reports → select category → trend analysis → export PDF |

### 2.3 Data Architecture

#### Azure Table Storage — 11 Tables

| Table | PartitionKey | RowKey | Purpose |
|-------|-------------|--------|---------|
| `users` | "user" | email | Auth (email, password_hash, role) |
| `healthdata` | user_sub | "data" | 4-section health data + settings |
| `scanhistory` | user_sub | scan_id (UUID) | Health Scan image analysis history |
| `uploadhistory` | user_sub | upload_id (UUID) | CSV files + analysis JSON |
| `assessments` | user_sub + date | resident_id | 44 clinical indicators per resident per quarter |
| `qiaggregates` | user_sub | assessment_date | Pre-computed 14-category dashboard data |
| `gpmssubmissions` | user_sub | assessment_date | Government submission form data |
| `voicelinks` | "link" | token (hex) | Time-limited recording URLs (7-day expiry) |
| `voiceresidents` | "resident" | profile_id | Resident voice accounts (password, consent) |
| `voicerecordings` | profile_id | recording_id | Audio metadata + file paths |
| `voiceanalysis` | profile_id | analysis_id | Acoustic features, risk scores, narrative, transcript |

#### 44 Clinical Indicators across 14 QI Categories

| QI # | Category | Indicators | Data Type |
|------|----------|-----------|-----------|
| QI 01 | Pressure Injuries | PI_01, PI_S1-S4, PI_US, PI_DTI | Binary (0/1) |
| QI 02 | Restrictive Practices | RP_01, RP_MECH, RP_PHYS, RP_ENV, RP_SEC | Binary |
| QI 03 | Unplanned Weight Loss | UWL_SIG, UWL_CON | Binary |
| QI 04 | Falls & Major Injury | FALL_01, FALL_MAJ | Binary |
| QI 05 | Medications | MED_POLY, MED_AP | Binary |
| QI 06 | Activities of Daily Living | ADL_01 + 10 Barthel sub-scores (Bowels, Bladder, Grooming, Toilet, Feeding, Transfer, Mobility, Dressing, Stairs, Bathing) | Binary + Float |
| QI 07 | Incontinence Care | IC_IAD, IAD_1A, IAD_1B, IAD_2A, IAD_2B | Binary |
| QI 08 | Hospitalisation | HOSP_ED, HOSP_ALL | Binary |
| QI 09 | Workforce | WF_HOURS_PPD, WF_ADEQUATE | Float + Binary |
| QI 10 | Consumer Experience | CE_01 | Float (0-24 scale) |
| QI 11 | Quality of Life | QOL_01 | Float (0-24 scale) |
| QI 12 | Enrolled Nursing | EN_DIRECT_PCT | Float (%) |
| QI 13 | Allied Health | AH_REC_RECOMMENDED, AH_REC_RECEIVED + 7 discipline columns (Physio, OT, Speech, Podiatry, Dietetics, Other, Assist) | Binary + Float |
| QI 14 | Lifestyle Officer | LS_SESSIONS_QTR | Integer (avg) |

### 2.4 System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                │
│  Port 5173 | Tailwind CSS | Framer Motion | Recharts     │
│  Google OAuth | Axios + JWT | localStorage persistence    │
└───────────────────────┬──────────────────────────────────┘
                        │ REST API (JSON + multipart)
                        │ Authorization: Bearer <JWT>
┌───────────────────────┴──────────────────────────────────┐
│                   BACKEND (FastAPI + Uvicorn)             │
│  Port 8000 | 7 Routers | 11 DB Services | JWT Auth       │
│                                                           │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐  │
│  │  Auth   │ │ QI/GPMS  │ │ Upload │ │    Voice      │  │
│  │ Router  │ │ Routers  │ │ CSV    │ │   Router      │  │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬────────┘  │
│       │           │           │              │            │
│  ┌────┴───────────┴───────────┴──────────────┴─────────┐ │
│  │              11 Database Service Layer               │ │
│  │  user_store | assessment_db | qi_aggregate_db        │ │
│  │  upload_history_db | gpms_db | health_data_db        │ │
│  │  scan_history_db | voice_link_db | voice_profile_db  │ │
│  │  voice_recording_db | voice_analysis_db              │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           │                               │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │         Azure Table Storage (or in-memory)          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  OpenAI API      │  │  Voice Processor             │  │
│  │  gpt-4o-mini     │  │  (Pure Python, stdlib only)  │  │
│  │  whisper-1       │  │  Acoustic feature extraction │  │
│  └──────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Interface Design & Style Guide

### 3.1 Design Principles

- **Clinical clarity**: Traffic-light colour coding (green/amber/red) for instant status comprehension
- **Data density over decoration**: Dashboards prioritise information density; no ornamental graphics
- **Elderly accessibility**: Voice recording UI uses large fonts, high contrast, minimal interaction
- **Consistency**: Tailwind utility classes enforce uniform spacing, typography, and colour
- **Progressive disclosure**: Collapsible GPMS sections, tabbed detail views, expandable cards

### 3.2 Key Screens

**Landing Page** — Hero banner (black text zone + banner image with gradient), 6 feature cards, 14 QI category indicators, "Why Choose Us" section, CTA to login/dashboard

**QI Dashboard** — 14 traffic-light summary cards (category name, prevalence %, status badge, trend arrow), quarter selector, summary strip (total residents, categories at risk, last submission), trend line chart, status distribution donut, radar chart (all 14 categories)

**Data Entry** — CSV file picker with drag-and-drop, progress bar, 13-section GPMS form (collapsible), auto-populated fields from CSV, save/submit workflow

**Voice Dashboard** — Summary cards (total residents, active alerts), alerts feed (scrollable, acknowledge button), searchable resident input for link generation, tag-based batch link UI, sortable residents table (Resident, Status, Speech Rate, Pause, Deviation, Recordings, Actions), 5 detail tabs (Trend Chart, Baseline Compare, Acoustic Profile, Transcript, QI Flags)

**Voice Record Page** — Step wizard: validate link → register/login → consent → prompt display → record button (large, centered) → upload confirmation. Designed for elderly users.

**Benchmarking** — Side-by-side bar charts (facility rate vs AIHW national median), percentile ranking, colour-coded above/below indicators

**Reports** — Sidebar with 14 QI categories, trend line charts (quarter-over-quarter per indicator), resident-level data tables, PDF/Excel export

**Login** — Two-column layout (banner left, form right), email/password fields, Google OAuth button, "Remember me" checkbox

**Settings** — Tabbed: Facility Profile (name, ABN, type, bed capacity, contacts, quality manager), National Benchmarks (read-only AIHW figures), Data Retention (12/24/36 months/indefinite)

### 3.3 UI Components

| Component | Implementation | Usage |
|-----------|---------------|-------|
| **Navbar** | Fixed top, `bg-dark`, logo left, nav centre (absolute-positioned), profile right | All pages |
| **Footer** | Black, copyright, links to Privacy/Terms/About/Contact | Public pages |
| **Button** | `bg-primary text-white font-semibold rounded-md px-6 py-3` | CTAs throughout |
| **Card** | `bg-white border border-gray-100 rounded-xl shadow-md p-6` | Feature cards, QI cards, settings |
| **Traffic-light Badge** | `bg-green-500` / `bg-yellow-500` / `bg-red-500` + white text | QI status, voice alerts |
| **Trend Arrow** | Up (improving/worsening depending on direction) / Stable / Down | Dashboard cards |
| **Searchable Input** | Text input with filtered dropdown suggestions | Voice resident ID selection |
| **Tag Input** | Type + Enter → chip badges, "Generate All" button | Batch link generation |
| **Sortable Table** | Column headers toggle ascending/descending sort | Voice residents table |
| **RecordingWidget** | MediaRecorder API wrapper; state machine: idle → recording → recorded → uploading → done | Voice record page |
| **VoiceAlertsFeed** | Scrollable list; resident name, narrative, confidence, Acknowledge button | Voice dashboard |
| **ScrollToTop** | Auto-scrolls on route change | Global (App.jsx) |

### 3.4 Branding & Style Guide

| Token | Value | Usage |
|-------|-------|-------|
| **Primary** | `#ff7b00` (orange) | CTA backgrounds, active nav underline, accents |
| **Secondary** | `#E58411` | Chart palette |
| **Info** | `#2F80ED` | Informational charts |
| **Success** | `#27AE60` | Green status, positive trends |
| **Warning** | `#E2B93B` | Amber status, caution indicators |
| **Error** | `#EB5757` | Red status, critical alerts |
| **Dark** | `#111111` | Navbar, footer |
| **Hero bar** | `#040404` | Intentional black top bar in hero |
| **Grayish** | `#1a1a1a` | Section dividers |
| **Light** | `#f9f9f9` | Backgrounds |
| **Font** | Inter (Google Fonts) | Weights 300, 400, 500, 600, 700 |
| **Headings** | `font-semibold` (600) | All section headings |
| **Body** | `text-gray-600` on light BG | Paragraphs |
| **Section spacing** | `py-20 px-6` | Consistent vertical rhythm |
| **Max width** | `max-w-6xl` or `max-w-7xl` | Content containers |
| **Animation** | Framer Motion: `opacity: 0→1, y: 20→0` | Page enters, card reveals |
| **Charts** | Recharts: LineChart, BarChart, RadarChart, PieChart | No purple; style guide palette only |

---

## 4. Functionality & User Interaction

### 4.1 Use Case Descriptions

#### UC-01: Register & Login

- **Actor:** Nurse/DON
- **Flow:** Navigate to `/register` → enter name, email, password → system validates (8+ chars, strength indicator) → account created → JWT issued → redirect to `/dashboard`
- **Alt:** Google OAuth → backend validates Google JWT → creates/finds user → JWT issued
- **Post:** User stored in `users` table (bcrypt hash)

#### UC-02: Upload QI CSV Data

- **Actor:** Quality Manager
- **Precondition:** Logged in
- **Flow:** Navigate to Data Entry → select CSV file (max 5 MB) → upload → system parses rows → extracts quarter labels from Assessment_Date → computes 14 category prevalence rates → determines traffic-light status (green/amber/red thresholds) → computes trend arrows → flags residents at risk (>=2 indicators) → auto-computes GPMS fields → stores assessments, aggregates, GPMS, upload history
- **Output:** Dashboard populated, GPMS form pre-filled

#### UC-03: View QI Dashboard

- **Actor:** DON
- **Flow:** Navigate to `/dashboard` → system fetches all QI aggregates → renders 14 traffic-light cards (name, rate %, status, trend) → summary strip (total residents, categories at risk) → click card → trend line chart + severity breakdown (stacked bar for PI staging, gap analysis for AH, etc.)

#### UC-04: Benchmark Against National

- **Actor:** DON
- **Flow:** Navigate to Benchmarking → system displays facility rates alongside AIHW published national medians → side-by-side bar charts → colour-coded (green if below median, red if above for "lower is better" indicators)
- **AIHW National Medians:** PI 10.2%, Falls 8.3%, UWL 5.1%, Meds 19.8%, ADL 20.1%, IC 6.9%, RP 7.8%, Hosp 11.0%, AH Gap 34%, CX 75%, QoL 66%, WF 90%, EN 91%, LS 2.1 avg

#### UC-05: Generate Voice Recording Link

- **Actor:** Nurse
- **Flow:** Voice Dashboard → type resident ID (searchable input, filtered dropdown) → Generate Link → system creates token (UUID hex, 7-day expiry) → displays URL → nurse copies and shares with resident
- **Batch:** Type multiple IDs as tags → Generate All → system creates links for each

#### UC-06: Record Voice Sample

- **Actor:** Resident
- **Precondition:** Has valid link (not expired)
- **Flow:** Open link → system validates token → if no account: register (display name + 4-char password) → if has account: login → consent screen (first time only) → see reading prompt (3 types: counting, open response, read aloud) → press Record → speak up to 60 seconds → press Stop → press Upload → WAV sent to backend
- **Post:** Background analysis triggered (acoustic extraction → baseline comparison → alert level → narrative generation → transcription)

#### UC-07: Review Voice Alerts

- **Actor:** Nurse
- **Flow:** Voice Dashboard → Alerts Feed shows unacknowledged amber/red alerts → each alert shows resident name, narrative, confidence, timestamp → click Acknowledge → alert removed from feed, counter decremented
- **Escalation:** Red alerts flag QI integration (ADL decline, falls risk, medication review)

#### UC-08: Voice QI Integration

- **Actor:** System (automated)
- **Trigger:** Voice analysis completes with amber/red alert
- **Mapping:**
  - Speech rate + pause change >20% → QI 06 (ADL)
  - Pause duration >25% → QI 04 (Falls risk)
  - Energy change >30% → QI 05 (Medication review)
  - Red alert → QI 08 (ED prevention)
  - Vocal fatigue <0.7 → QI 11 (Depression screening)

#### UC-09: Submit GPMS Form

- **Actor:** Quality Manager
- **Flow:** Data Entry → GPMS tab → 13 collapsible sections (PI, RP, UWL, Falls, MedsPoly, MedsAP, ADL, IC, Hosp, AH, CX, QoL, WF) → fields auto-populated from CSV → review/edit → Save (draft) or Submit (mark as formally submitted)

#### UC-10: Analyse Health Record Image (Legacy)

- **Actor:** User
- **Flow:** Upload 1-5 health record images → OpenAI gpt-4o-mini Vision extracts structured data (4 sections: keyInformation, patientContext, clinicalMeasurements, trendAndRisk) → generates recommendations (actions, diet, exercise, risks) → stores in scan history

#### UC-11: Manage Facility Profile

- **Actor:** Facility Administrator
- **Flow:** Settings → Facility Profile tab → edit name, registration #, NAPS ID, ABN, type (Residential/Short-term/Transition), state, bed capacity, contacts, quality manager details → Save

### 4.2 User Flows

#### Nurse Daily Workflow

Login → Dashboard (check 14 QI cards for red/amber) → Voice Dashboard (review alerts → acknowledge) → Reports (drill into flagged categories) → Data Entry (if new quarter data available)

#### Quarterly Submission Workflow

Upload CSV → Dashboard auto-populates → Review GPMS form (auto-filled) → Edit if needed → Submit → Generate reports for board papers → Benchmark against national

#### Voice Screening Workflow

Nurse generates link → Shares with resident → Resident opens link → Registers (first time) → Records voice → System analyses (acoustic features + transcription) → If deviation >5%: alert created → Nurse reviews alert → Acknowledges or escalates

### 4.3 Sequence Diagrams

#### CSV Upload → Dashboard Population

```
Quality Manager → Frontend: Upload CSV
Frontend → Backend POST /upload-csv: CSV file
Backend: Parse rows, extract quarters
Backend: Compute 14 QI category rates
Backend: Determine status (thresholds) + trend (vs previous quarter)
Backend: Flag residents at risk (>=2 indicators)
Backend: Compute GPMS fields
Backend → Azure: Store assessments (batch 100/txn)
Backend → Azure: Store aggregates
Backend → Azure: Store GPMS
Backend → Azure: Store upload history
Backend → Frontend: {uploadId, analysis, gpmsFields}
Frontend: Render dashboard cards, charts, summary
```

#### Voice Recording → Alert

```
Resident → Frontend: Open recording link
Frontend → Backend GET /voice/links/{token}: Validate
Backend → Frontend: {valid, resident_id, has_account}
Resident → Frontend: Register/Login
Frontend → Backend POST /voice/residents/register: {token, name, password}
Backend → Frontend: {access_token, profile}
Resident → Frontend: Grant consent
Frontend → Backend PUT /voice/consent: {consent_given: true}
Resident → Frontend: Record audio (60s max)
Frontend → Backend POST /voice/recordings: WAV file
Backend: Save to disk, create recording entry
Backend (background): Extract acoustic features
  - speech rate, pauses, pitch, jitter, shimmer, ZCR, spectral centroid
Backend (background): Compare to baseline → deviation %
Backend (background): Determine alert level (green <5%, amber 5-15%, red >15%)
Backend (background): Generate narrative (LLM or template)
Backend (background): Transcribe via Whisper
Backend → Azure: Store analysis
Nurse → Frontend: Open Voice Dashboard
Frontend → Backend GET /voice/alerts: Fetch unacknowledged
Backend → Frontend: [{analysis_id, resident, narrative, alert_level, confidence}]
Nurse → Frontend: Click Acknowledge
Frontend → Backend PUT /voice/alerts/{id}/acknowledge
```

### 4.4 Future AI Features

- **Predictive QI modelling**: Use historical quarterly trends + voice biomarkers to predict which residents are likely to trigger indicators in the next quarter
- **Natural language report generation**: LLM-generated board paper narratives from QI data
- **Multi-modal risk scoring**: Combine QI indicators + voice biomarkers + ADL scores into a unified risk score per resident
- **Automated peer facility comparison**: Cluster facilities by size/remoteness/ownership for fairer benchmarking

---

## 5. Methodology & Design Process

### 5.1 Methodology Overview

Agile/iterative development in 3 phases:

**Phase 1 — Foundation:**
- User auth (JWT + Google OAuth)
- My Data storage
- Health Scan (OpenAI Vision)
- Care Journey timeline
- Settings
- Landing page

**Phase 2 — QI Core:**
- CSV upload with 14-category QI parsing
- GPMS form auto-population
- QI Dashboard with traffic-light cards
- Benchmarking page
- Reports module
- AWS → Azure migration (Cognito → JWT, DynamoDB → Azure Table Storage)

**Phase 3 — Voice + Polish:**
- Voice biomarker screening (link generation, recording, acoustic analysis, alerts, QI integration)
- Demo data seeding (3 residents with realistic clinical trajectories)
- UI overhaul (Inter font, style guide palette, chart diversity, sortable tables, searchable inputs)
- Landing page content refresh

### 5.2 Development Process

- **Source control**: Git, branch-per-feature merged to `main`
- **Tech decisions documented**: CLAUDE.md continuously updated with architecture, API details, quirks
- **Plan-before-code**: Every multi-file task preceded by structured plan (Context → Design Decisions → Implementation Steps → Verification)
- **Azure migration**: Documented in MIGRATION-AWS-TO-AZURE.md with removed files, changed APIs, new dependencies

---

## 6. Evaluation Approach

### 6.1 Testing

- **Unit test framework**: `@testing-library/react` + `@testing-library/jest-dom` (present but minimal coverage)
- **API testing**: Manual endpoint testing with `requests` library (confirmed during voice seed debugging)
- **Integration testing**: End-to-end flows verified manually (CSV upload → dashboard → benchmarking; voice link → record → alert → acknowledge)
- **Azure Table Storage validation**: Direct table queries to verify data persistence and partition key strategy
- **Demo data verification**: 3 seeded residents (R001 green, R002 amber, R003 red) confirmed via API calls

### 6.2 Feedback

- **Iterative UI refinement**: Hero banner positioning refined over 5+ iterations (padding, typography, colour adjustments)
- **Style guide enforcement**: Purple eliminated from all charts; palette restricted to Secondary #E58411, Info #2F80ED, Success #27AE60, Warning #E2B93B, Error #EB5757
- **Chart diversity feedback**: Replaced all-LineChart views with mixed types (LineChart for trends, BarChart for comparison, RadarChart for profiles, PieChart/donut for distribution)
- **Scalability feedback**: Card grid replaced with sortable table for 100+ resident support in voice dashboard
- **Accessibility feedback**: Native `<select>` replaced with searchable text input for resident ID selection

---

## 7. Prototype & Technical Overview

### 7.1 System Setup

#### Backend

```
Framework:     FastAPI 0.119.0 + Uvicorn 0.37.0
Language:      Python 3.x
Auth:          python-jose 3.3.0 (JWT HS256) + passlib (bcrypt)
Storage:       azure-data-tables >= 12.4.0 (11 tables, in-memory fallback)
AI:            openai >= 1.0.0 (gpt-4o-mini for vision/narrative, whisper-1 for transcription)
Config:        pydantic-settings (env-based)
Port:          8000
```

#### Frontend

```
Framework:     React 19.2.0
Build:         Vite 6.4.0
Styling:       Tailwind CSS 3.4.18 (Inter font, custom colour tokens)
Animation:     Framer Motion 12.23.24
Charts:        Recharts 3.2.1 (Line, Bar, Radar, Pie)
Auth:          @react-oauth/google 0.12.2
HTTP:          Axios 1.12.2 (JWT interceptor, 401 auto-redirect)
Icons:         @heroicons/react 2.2.0 + lucide-react 0.546.0
Export:        html2canvas 1.4.1 + jspdf 2.5.2 + xlsx 0.18.5
Port:          5173 (Google OAuth registered)
```

#### Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | Backend | JWT signing secret |
| `AZURE_STORAGE_CONNECTION_STRING` | Backend | Azure Table Storage (optional; in-memory fallback) |
| `OPENAI_API_KEY` | Backend | Health Scan, voice narrative, Whisper transcription |
| `VOICE_UPLOAD_DIR` | Backend | Audio file storage path (default: `voice_uploads`) |
| `VOICE_LINK_EXPIRY_HOURS` | Backend | Link TTL (default 168h / 7 days) |
| `VOICE_LINK_BASE_URL` | Backend | Base URL for generated links |
| `VITE_API_BASE_URL` | Frontend | Backend API URL |
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Google OAuth client ID |

### 7.2 System Components

#### 7 API Routers

1. **Auth** (`/auth`) — register, login, Google OAuth, current user
2. **Upload CSV** (`/upload-csv`) — CSV ingestion, 14-category QI computation, GPMS auto-population, history
3. **QI** (`/api/qi`) — aggregate queries (all dates / single date), resident-level drill-down
4. **GPMS** (`/api/gpms`) — government submission form CRUD
5. **Voice** (`/api/voice`) — link management, recording, analysis, alerts, QI flags, consent, reports
6. **Health Scan** (`/health-scan`) — OpenAI Vision image analysis, history (legacy)
7. **My Data** (`/mydata`) — personal health data, settings, AI recommendations

#### 11 Database Services

Each service has Azure Table Storage implementation + in-memory fallback:

| Service | Azure Table | Purpose |
|---------|------------|---------|
| `user_store` | `users` | User accounts (register/login) |
| `health_data_db` | `healthdata` | 4-section health data + settings |
| `scan_history_db` | `scanhistory` | Health Scan image analysis history |
| `upload_history_db` | `uploadhistory` | CSV files + analysis JSON |
| `assessment_db` | `assessments` | Resident-level QI assessments (44 columns) |
| `qi_aggregate_db` | `qiaggregates` | Pre-computed 14-category dashboard data |
| `gpms_db` | `gpmssubmissions` | Government submission form data |
| `voice_link_db` | `voicelinks` | Time-limited recording URLs |
| `voice_profile_db` | `voiceresidents` | Resident voice accounts |
| `voice_recording_db` | `voicerecordings` | Audio metadata + file paths |
| `voice_analysis_db` | `voiceanalysis` | Acoustic features, risk scores, narrative, transcript |

#### Voice Processor (Pure Python, stdlib only)

Feature extraction pipeline with no external ML libraries:

1. **WAV decoding** → extract channels, sample width, sample rate, samples
2. **Frame energy** → 20ms windows, RMS energy per frame
3. **Adaptive threshold** → max(FLOOR, peak_rms * ENERGY_RATIO)
4. **Speech/silence labelling** → label frames based on threshold
5. **Pause detection** → consecutive silence >= 300ms
6. **Speech rate** → speech-to-silence transitions per second of speech
7. **Zero-crossing rate (ZCR)** → frequency crossings per sample
8. **Pitch estimation** → autocorrelation of speech frames → fundamental frequency F0
9. **Jitter** → cycle-to-cycle F0 variation (%)
10. **Shimmer** → amplitude variation between frames (%)
11. **Spectral centroid** → energy-weighted frequency centre

Output features:
```
duration_s, speech_duration_s, pause_duration_s, pause_count,
mean_pause_duration_s, speech_rate_proxy, mean_energy, energy_std,
vocal_fatigue_index, pitch_mean_hz, pitch_std_hz, jitter_pct,
shimmer_pct, zcr_mean, spectral_centroid_hz
```

Baseline comparison: per-feature % change → weighted overall deviation → alert level (green <5%, amber 5-15%, red >15%)

#### QI Dashboard Computation Engine

14 indicator categories with configurable thresholds:

| ID | Category | Calculation | Thresholds (Amber / Red) | Direction |
|----|----------|-------------|--------------------------|-----------|
| pi | Pressure Injuries | % binary | 6% / 10% | Lower is better |
| falls | Falls & Major Injury | % binary | 8% / 12% | Lower is better |
| uwl | Unplanned Weight Loss | % binary | 4% / 8% | Lower is better |
| meds | Medications | % binary | 15% / 25% | Lower is better |
| adl | Activities of Daily Living | % binary | 15% / 25% | Lower is better |
| incontinence | Incontinence Care | % binary | 4% / 8% | Lower is better |
| rp | Restrictive Practices | % binary | 4% / 8% | Lower is better |
| hosp | Hospitalisation | % binary | 9% / 14% | Lower is better |
| allied_health | Allied Health (gap) | AH gap % | 25% / 40% | Lower is better |
| consumer_exp | Consumer Experience | avg float | <16 / <12 | Higher is better |
| qol | Quality of Life | avg float | <16 / <12 | Higher is better |
| workforce | Workforce | % binary | <90% / <80% | Higher is better |
| enrolled_nursing | Enrolled Nursing | avg float | <90% / <80% | Higher is better |
| lifestyle | Lifestyle Officer | avg int | <2.0 / <1.0 | Higher is better |

### 7.3 API Overview

| Router | Endpoints | Auth | Key Capabilities |
|--------|-----------|------|-----------------|
| Auth | 4 | Public/JWT | Register, login, Google OAuth, profile |
| Upload CSV | 7 | JWT | CSV parse, 14-category QI compute, GPMS auto-fill, history CRUD |
| QI | 4 | JWT | Aggregates (all/by-date), residents (by-date/by-id) |
| GPMS | 4 | JWT | Form CRUD, submission tracking |
| Voice | 20+ | JWT/Resident | Links, recording, analysis, alerts, consent, QI flags, reports |
| Health Scan | 4 | JWT | Image analysis (OpenAI Vision), history |
| My Data | 5 | JWT | Health data CRUD, settings, AI recommendations |

**Total: 48+ REST endpoints**

---

## 8. Roadmap & Future Work

### 8.1 Azure Deployment Plan

- **Backend**: Azure App Service (Linux, Python 3.x) or Azure Container Apps
- **Frontend**: Azure Static Web Apps (auto-builds from Git) or existing Netlify/CloudFront
- **Storage**: Azure Table Storage already configured (connection string in env)
- **Secrets**: Migrate from `.env` files to Azure Key Vault
- **Domain**: Custom domain with SSL (replace localhost:5173 in Google OAuth registration)
- **Production CORS**: Update allowed origins from localhost to production domain

### 8.2 Future Improvements

- **QI 09-12, 14 indicators**: Workforce, Consumer Experience, Quality of Life, Enrolled Nursing, Lifestyle Officer — indicator definitions to be finalised
- **Multi-facility support**: Extend architecture with facility_id partitioning for multi-tenancy
- **Role-based access control**: Add "admin" and "auditor" (read-only) roles beyond current "user" and "resident"
- **Real-time notifications**: WebSocket or SSE for voice alerts instead of polling
- **Predictive analytics**: Time-series forecasting on QI trends to predict next-quarter risk
- **Multi-modal risk scoring**: Combined QI + voice + ADL → unified resident risk index
- **Audit trail**: Immutable log of all data changes for regulatory compliance
- **FHIR integration**: Interop with clinical systems via HL7 FHIR standard
- **Offline recording**: Service worker for voice recording without internet (sync when online)
- **Natural language reports**: LLM-generated board paper narratives from dashboard data
- **PDF export**: Full QI report and voice analysis PDF generation for board papers
- **Email notifications**: Automated alerts for red-status indicators and voice screening results

### 8.3 CI/CD

- **Current state**: No CI/CD pipeline configured (no GitHub Actions, no Azure Pipelines, no Dockerfiles)
- **Planned**: GitHub Actions workflow — lint (ESLint + Ruff) → test → build → deploy to Azure Static Apps (frontend) + Azure App Service (backend)
- **Secrets scanning**: Add `trufflehog` or GitHub secret scanning to prevent credential commits
- **Docker**: Containerise backend (`Dockerfile` with `uvicorn` entrypoint) for consistent deployment
- **Staging environment**: Deploy to staging slot before production swap

---

## 9. Conclusion

CareData is a purpose-built clinical governance platform that unifies Quality Indicator tracking, government submission preparation, national benchmarking, and AI-powered voice biomarker screening into a single portal for aged care facilities. The platform processes 14 QI categories aligned to the AIHW QI Program Manual 4.0, automatically computes prevalence rates and trend analysis from uploaded CSV data, and pre-populates GPMS government submission forms. The voice biomarker module introduces a novel screening capability — using pure-Python acoustic analysis (speech rate, pauses, pitch, jitter, shimmer, spectral centroid) to detect early signs of cognitive decline, stroke risk, and physical deterioration between quarterly assessment windows. With 48+ REST API endpoints, 11 Azure Table Storage tables, and integration with OpenAI for image analysis and transcription, the platform provides a comprehensive technical foundation for clinical governance in Australian residential aged care.
