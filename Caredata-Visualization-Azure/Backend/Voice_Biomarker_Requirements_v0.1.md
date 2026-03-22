# Voice Biomarker Screening
## Initial Requirements Document

**Product**: CareData Portal — Voice Biomarker Module
**Version**: Draft 0.1
**Date**: March 2026
**Status**: Initial requirements — pending clinical advisory review
**Author**: Product team

---

## 1. Feature overview

Voice Biomarker Screening is an AI-powered module within CareData Portal that analyses short voice recordings from aged care residents to detect early indicators of stroke risk, cognitive decline, depression onset, urinary tract infection-related delirium, and general neurological deterioration — often days or weeks before clinical symptoms become visible to care staff.

The module captures a 30–60 second voice sample from each resident on a recurring basis (minimum quarterly, ideally monthly). An AI model analyses acoustic and linguistic biomarkers in the recording and generates a clinical risk report that is surfaced to nursing staff through the CareData Portal dashboard.

### What it detects

| Condition | Voice biomarkers | Detection window |
|-----------|-----------------|-----------------|
| Stroke risk / TIA | Asymmetric articulation, slurred consonants, irregular speech rhythm, sudden onset dysarthria | Hours to days before major event |
| Cognitive decline (early dementia) | Increased pause duration, reduced speech rate, word-finding hesitations, simplified sentence structure, reduced vocabulary diversity | Weeks to months ahead of clinical diagnosis |
| Depression onset | Monotone pitch, reduced pitch variability, slower tempo, lower energy, shorter utterances | Days to weeks before behavioural symptoms |
| UTI-related delirium | Acute speech confusion, incoherent phrasing, sudden change from baseline fluency, disorganised thought flow | 24–72 hours before clinical presentation |
| Dysphagia risk | Wet/gurgly voice quality, breathy phonation, reduced volume, vocal fatigue during recording | Days to weeks before aspiration event |
| General deterioration | Deviation from resident's own established voice baseline across any measured parameter | Variable |

### Why it matters

These conditions are currently detected reactively — after a fall, after a hospital transfer, after visible symptoms alarm staff. Voice analysis shifts the detection point upstream. In a facility of 100 residents with 2 clinical staff per shift, subtle voice changes are impossible to track manually. The AI provides the consistency and longitudinal memory that human observation cannot.

---

## 2. User roles and workflows

### 2.1 Nurse / clinical staff (primary user)

The nurse is the operator. They do not listen to every recording — they act on the AI's output.

**Workflow:**
1. Nurse logs into CareData Portal
2. Navigates to Voice Biomarker section under the resident's profile
3. Clicks "Generate recording link" for a specific resident
4. A unique, time-limited URL is generated (valid for 7 days, single-use per session)
5. Nurse shares the link with the resident — verbally, printed QR code on a card, or via a facility tablet
6. Once the resident completes the recording, the nurse sees the status change to "Recording received"
7. AI analysis runs automatically (async, typically <60 seconds)
8. Results appear on the resident's dashboard as a risk summary card with trend over time
9. If any biomarker triggers an alert threshold, the nurse receives a notification (in-app + optional email)
10. Nurse reviews the alert, documents clinical follow-up action in the portal

**Key actions for nurse:**
- Generate and share recording links (individual or batch for all residents)
- View AI analysis results and risk scores per resident
- View trend charts (voice biomarker trajectory over quarters)
- Acknowledge and action alerts
- Export voice biomarker summary for clinical governance reports
- Cannot listen to voice recordings (owned by resident — see privacy model below)

### 2.2 Resident (recording subject)

The resident is the voice source. They interact with a minimal, accessible web interface — not the full CareData Portal.

**Workflow:**
1. Resident receives a link (URL or QR code) from the nurse
2. Opens the link on any device — facility tablet, personal phone, or bedside device
3. First time only: creates a simple account with display name and password (no email required)
4. Subsequent visits: logs in with name + password
5. Sees a large, simple interface: one button that says "Start recording"
6. A scripted prompt appears on screen for the resident to read aloud or respond to (see Section 4)
7. Resident records for 30–60 seconds
8. Resident taps "Done" — recording uploads automatically
9. Resident can see their own past recordings and play them back (their data, their ownership)
10. Resident can delete any of their own recordings at any time

**Accessibility requirements for resident interface:**
- Minimum font size: 20px body, 28px headings
- High contrast mode (WCAG AAA)
- No complex navigation — single-screen flow
- Works on tablets and smartphones (responsive, touch-optimised)
- Audio instructions available (tap speaker icon to hear the prompt read aloud)
- Supports screen readers
- No timeout on the recording screen — resident can take as long as needed
- Language: English default, configurable per facility (Mandarin, Italian, Greek, Vietnamese, Arabic for Australian aged care demographics)

### 2.3 Facility manager / quality manager

- Views aggregate voice biomarker data across all residents
- Accesses trend reports for clinical governance meetings
- Configures alert thresholds per facility
- Manages consent records

---

## 3. Recording link mechanics

### Link generation

When a nurse clicks "Generate recording link" for a resident:

1. Backend creates a unique token tied to: resident_id, facility_id, nurse_id (who generated it), creation timestamp, expiry timestamp
2. URL format: `https://app.caredata.com.au/voice/{token}`
3. Token is a cryptographically random string (UUID v4 or similar)
4. Link expires after 7 days or after one successful recording submission, whichever comes first
5. Expired links show a friendly message: "This link has expired. Please ask your nurse for a new one."

### Batch link generation

Nurse can select multiple residents and generate links in bulk. Output options:
- Downloadable PDF with one QR code per resident (name + QR on a printable card)
- CSV of resident name + URL for bulk distribution
- Direct display on a facility-managed tablet (nurse taps through residents one by one)

### Resident authentication

**First access:**
- Resident opens the link
- Prompt: "Welcome. Please create your name and password to get started."
- Fields: Display name (free text, no validation — they can use "Margaret" or "Nan" or whatever they prefer), Password (minimum 4 characters, no complexity rules — this is an 85-year-old user)
- Account is created and linked to the resident_id from the token
- Resident is logged in immediately

**Subsequent access:**
- Same link or a new link for the same resident_id
- Prompt: "Welcome back, [name]. Please enter your password."
- Login, then proceed to recording screen

**Password reset:**
- Nurse can reset a resident's password from the portal (generates a new temporary password the nurse gives verbally)
- No email-based reset (residents may not have email)

---

## 4. Voice prompts (what the resident reads/responds to)

The recording needs to elicit specific speech patterns for the AI to analyse. The prompts are designed to be natural, non-clinical, and engaging for older adults.

### Prompt set A — Read aloud (tests articulation, fluency, reading ability)

> "The sun was warm on the old stone wall. Margaret picked up her cup of tea and watched the birds in the garden. It was a quiet morning, and she was glad of it."

This is a phonetically balanced passage covering all major consonant clusters, vowel sounds, and natural pauses. It's modelled on the "Grandfather Passage" used in speech pathology but written in Australian English with culturally familiar imagery.

### Prompt set B — Open response (tests word-finding, thought organisation, spontaneous speech)

> "Tell me about your favourite meal. What was it, and who were you with?"

Autobiographical questions trigger episodic memory retrieval and produce spontaneous speech with natural pauses, word-finding moments, and emotional tone — all of which are biomarker-rich.

### Prompt set C — Counting and sequencing (tests cognitive processing)

> "Please count backwards from 20 to 1, nice and steady."

Simple cognitive load task that reveals processing speed, sequencing ability, and hesitation patterns.

### Prompt rotation

The system rotates prompts each session so the resident doesn't memorise and recite from memory (which would mask cognitive decline). A pool of 10+ prompts per category, randomised per session.

---

## 5. AI analysis pipeline

### 5.1 Audio preprocessing

1. Recording received as WAV or WebM from browser MediaRecorder API
2. Converted to 16kHz mono WAV (standard for speech analysis)
3. Noise reduction applied (facility background noise — TV, other residents, equipment)
4. Voice activity detection (VAD) to strip silence and non-speech segments
5. Duration validation: reject recordings <15 seconds of active speech

### 5.2 Acoustic feature extraction

Extract from the audio signal (no transcription needed):

| Feature category | Specific measures |
|-----------------|-------------------|
| Pitch (F0) | Mean, standard deviation, range, jitter (cycle-to-cycle variation) |
| Rhythm / tempo | Speech rate (syllables/sec), pause frequency, pause duration, rhythm regularity |
| Voice quality | Shimmer (amplitude variation), harmonic-to-noise ratio, breathiness index |
| Articulation | Formant frequencies (F1, F2), consonant-vowel transition sharpness, vowel space area |
| Energy | Mean intensity, intensity variation, vocal fatigue (energy decline over recording duration) |

### 5.3 Linguistic feature extraction (requires transcription)

1. Transcribe audio via Whisper API or equivalent
2. Extract from transcript:

| Feature category | Specific measures |
|-----------------|-------------------|
| Fluency | Words per minute, filled pauses ("um", "uh"), false starts, repetitions |
| Vocabulary | Type-token ratio, lexical diversity, word frequency distribution |
| Syntax | Mean sentence length, clause complexity, grammatical errors |
| Coherence | Topic maintenance, tangential speech episodes, incomplete thoughts |
| Word-finding | Pause-before-noun duration, circumlocution instances, pronoun-to-noun ratio |

### 5.4 Baseline comparison

Every metric is compared against the resident's own historical baseline — not a population norm. The system needs minimum 2 recordings to establish a baseline, and 4+ recordings for reliable trend detection.

**Alert logic:**
- Change of >1.5 standard deviations from personal baseline on any single metric = yellow flag
- Change of >2 standard deviations on any single metric OR >1.5 SD on 3+ metrics simultaneously = red flag
- Acute change (current recording vs immediately preceding recording, not long-term baseline) = urgent flag (stroke/delirium pathway)

### 5.5 AI risk report generation

After feature extraction and baseline comparison, an LLM (Claude or GPT-4o) receives:

**Input:**
- Current recording's extracted features (numeric)
- Historical feature trajectory (last 4–8 recordings)
- Deviation scores from baseline
- Resident's age and known conditions (from CareData profile)
- Prompt template specifying the clinical context

**Output:**
A structured risk report with:
- Overall voice health status: Stable / Changed / Alert
- Per-condition risk flags: Stroke risk, Cognitive decline, Depression, Delirium, Dysphagia
- Natural language clinical narrative: "Mrs Chen's speech rate has decreased 22% over the last three recordings, from 3.2 to 2.5 syllables per second. Pause duration before nouns has increased from 0.8s to 1.4s. These patterns are consistent with early word-finding difficulty. Recommend cognitive screening assessment."
- Recommended clinical actions
- Confidence level (low/medium/high) based on number of recordings in baseline and magnitude of change

---

## 6. Data model

### 6.1 Core entities

**Resident voice profile**
```
resident_voice_profile
├── profile_id (PK)
├── resident_id (FK → CareData resident record)
├── facility_id (FK)
├── display_name (set by resident)
├── password_hash
├── created_at
├── baseline_established (boolean)
├── baseline_recording_count
├── last_recording_date
└── consent_status (active / withdrawn)
```

**Voice recording**
```
voice_recording
├── recording_id (PK)
├── profile_id (FK → resident_voice_profile)
├── recorded_at (timestamp)
├── duration_seconds
├── prompt_id (FK → which prompt was shown)
├── audio_file_path (encrypted storage reference)
├── file_size_bytes
├── status (received / processing / analysed / error)
├── owned_by (always = resident — resident can delete)
└── deleted_at (soft delete, nullable)
```

**Voice analysis result**
```
voice_analysis
├── analysis_id (PK)
├── recording_id (FK → voice_recording)
├── analysed_at (timestamp)
├── model_version (which AI model version produced this)
│
├── acoustic_features (JSON blob)
│   ├── pitch_mean, pitch_sd, pitch_range, jitter
│   ├── speech_rate, pause_frequency, pause_mean_duration
│   ├── shimmer, hnr, breathiness
│   ├── vowel_space_area, formant_f1_mean, formant_f2_mean
│   └── intensity_mean, intensity_sd, vocal_fatigue_index
│
├── linguistic_features (JSON blob)
│   ├── words_per_minute, filled_pause_count, false_starts
│   ├── type_token_ratio, lexical_diversity
│   ├── mean_sentence_length, grammatical_errors
│   ├── coherence_score, tangential_episodes
│   └── pause_before_noun_mean, circumlocution_count
│
├── baseline_deviations (JSON blob)
│   ├── per-feature z-scores relative to personal baseline
│   └── flags_triggered (list of yellow/red/urgent)
│
├── risk_scores (JSON blob)
│   ├── stroke_risk (0.0–1.0)
│   ├── cognitive_decline_risk (0.0–1.0)
│   ├── depression_risk (0.0–1.0)
│   ├── delirium_risk (0.0–1.0)
│   └── dysphagia_risk (0.0–1.0)
│
├── narrative_report (text — LLM-generated clinical summary)
├── recommended_actions (text)
├── alert_level (none / yellow / red / urgent)
└── confidence (low / medium / high)
```

**Recording link**
```
recording_link
├── link_id (PK)
├── token (unique, cryptographic)
├── resident_id (FK)
├── facility_id (FK)
├── generated_by (FK → nurse user_id)
├── generated_at
├── expires_at
├── used (boolean)
└── used_at (nullable)
```

### 6.2 Data ownership and privacy

- Voice recordings are owned by the resident, not the facility
- Resident can view and delete their own recordings at any time
- Deletion is soft-delete in the database (retained for audit trail) but the audio file is permanently removed from storage
- Analysis results derived from deleted recordings are retained (feature vectors and risk scores) but the source audio is gone — the analysis cannot be reverse-engineered back to a voice
- Facility staff can see analysis results and risk reports but cannot listen to or download audio files
- Audio files are encrypted at rest (AES-256) and in transit (TLS 1.3)
- Audio files are stored in Australian data centres only (sovereignty requirement)
- Consent is recorded per-resident and can be withdrawn at any time — withdrawal stops future analysis but does not retroactively delete past analysis results (resident can separately request deletion of past recordings)

---

## 7. Backend architecture

### 7.1 High-level flow

```
Resident device (browser)
    │
    ├─ Records audio via MediaRecorder API (WebM/WAV)
    ├─ Authenticates via token + resident credentials
    └─ Uploads to ──►  API Gateway (REST)
                            │
                            ├─► Auth service
                            │     Validates link token + resident password
                            │
                            ├─► Storage service
                            │     Encrypts audio → S3-compatible object store
                            │     Writes metadata → PostgreSQL
                            │
                            └─► Analysis queue (async)
                                  │
                                  ├─► Audio preprocessor (worker)
                                  │     Noise reduction, VAD, format conversion
                                  │     Extracts acoustic features (local, no API call)
                                  │
                                  ├─► Transcription service
                                  │     Calls Whisper API (or equivalent)
                                  │     Returns transcript
                                  │
                                  ├─► Linguistic analyser (worker)
                                  │     Extracts linguistic features from transcript
                                  │
                                  ├─► Baseline comparator (worker)
                                  │     Fetches historical features for resident
                                  │     Computes z-scores and deviation flags
                                  │
                                  └─► Risk report generator
                                        Calls Claude / GPT-4o API with:
                                          - current features
                                          - baseline deviations
                                          - resident context
                                        Returns structured risk report + narrative
                                        Writes to voice_analysis table
                                        Triggers alert if threshold met
                                              │
                                              └─► Notification service
                                                    In-app alert to assigned nurse
                                                    Optional email / SMS
```

### 7.2 Technology choices

| Component | Recommended | Rationale |
|-----------|-------------|-----------|
| API framework | FastAPI (Python) | Python ecosystem for audio processing (librosa, parselmouth, praat-parselmouth) |
| Database | PostgreSQL | Relational data with JSONB for feature storage; time-series queries for trend analysis |
| Audio storage | S3-compatible (AWS S3 ap-southeast-2, or MinIO on-prem) | Encrypted object storage, Australian region |
| Task queue | Celery + Redis | Async processing pipeline for audio analysis |
| Audio preprocessing | librosa + parselmouth (Praat wrapper) | Industry-standard acoustic analysis |
| Transcription | OpenAI Whisper API (or self-hosted whisper.cpp) | Best accuracy for elderly speech with Australian accents |
| LLM for risk report | Claude API (Anthropic) or GPT-4o (OpenAI) | Structured clinical narrative generation |
| Frontend (resident) | React, minimal SPA | Accessible, single-screen recording interface |
| Frontend (nurse) | Integrated into existing CareData Portal | Dashboard cards, trend charts, alert panels |
| Hosting | AWS Sydney (ap-southeast-2) | Australian data sovereignty |

### 7.3 API endpoints

```
POST   /api/voice/links                  Generate recording link (nurse auth)
POST   /api/voice/links/batch            Generate links for multiple residents (nurse auth)
GET    /api/voice/links/{token}           Validate link and return resident auth status

POST   /api/voice/residents/register     Create resident voice account (link token auth)
POST   /api/voice/residents/login        Resident login (link token + password)
POST   /api/voice/residents/reset-password   Nurse resets resident password (nurse auth)

POST   /api/voice/recordings             Upload recording (resident auth)
GET    /api/voice/recordings             List resident's own recordings (resident auth)
GET    /api/voice/recordings/{id}/audio   Stream audio playback (resident auth only)
DELETE /api/voice/recordings/{id}         Resident deletes own recording (resident auth)

GET    /api/voice/analysis/{resident_id}          Latest analysis result (nurse auth)
GET    /api/voice/analysis/{resident_id}/history  Analysis trend over time (nurse auth)
GET    /api/voice/analysis/{resident_id}/report   Downloadable PDF risk report (nurse auth)

GET    /api/voice/alerts                  Facility-wide alert feed (nurse auth)
PUT    /api/voice/alerts/{id}/acknowledge Nurse acknowledges alert (nurse auth)

GET    /api/voice/facility/summary        Aggregate voice biomarker stats (manager auth)
```

### 7.4 Processing time targets

| Stage | Target | Notes |
|-------|--------|-------|
| Audio upload | <5 seconds | Depends on facility internet; support resume on failure |
| Preprocessing + acoustic features | <10 seconds | Local compute, no API call |
| Transcription (Whisper) | <15 seconds | API latency; can self-host for speed |
| Linguistic analysis | <5 seconds | Local compute on transcript |
| Baseline comparison | <2 seconds | Database query + z-score math |
| LLM risk report | <20 seconds | API call to Claude/GPT-4o |
| Total end-to-end | <60 seconds | From upload complete to results visible |

---

## 8. Integration with CareData Portal QI data

Voice biomarker results feed back into the existing QI framework:

- **ADL_01 (Barthel decline)** — Voice-detected motor speech changes correlate with functional decline; flag for early Barthel re-assessment
- **FALL_01 prediction** — Speech rhythm irregularity and processing speed changes are correlated with balance and gait issues; surface as fall risk modifier
- **MED_AP review** — Voice changes post-antipsychotic initiation (flat affect, sedation markers in speech) trigger medication review prompt
- **HOSP_ED prevention** — Acute voice changes suggesting stroke/TIA or delirium trigger clinical escalation pathway before the ED transfer happens
- **CE_01 / QOL_01** — Depression-related voice biomarkers provide an objective complement to the self-reported quality of life questionnaire

The voice module does not replace any existing QI. It adds a predictive and early-detection layer underneath the quarterly reporting cycle.

---

## 9. Consent and regulatory considerations

- Informed consent must be obtained from resident (or authorised representative for residents with cognitive impairment) before first recording
- Consent form must explain: what is recorded, how it is stored, who can access analysis results, that the resident owns the recording and can delete it at any time
- Consent must be documented in the resident's care record and in CareData Portal
- Voice data is classified as health information under the Privacy Act 1988 (Cth) and the Australian Privacy Principles
- The system must comply with the My Health Records Act 2012 if integrated with the national health record
- AI-generated risk reports must include a disclaimer: "This analysis is a clinical decision support tool. It does not constitute a diagnosis. All flagged conditions require clinical assessment by a qualified health professional."
- The system must not make autonomous clinical decisions — it generates alerts and recommendations for human clinicians to act on

---

## 10. Success metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recording completion rate | >70% of residents complete at least one recording per quarter | Count of recordings / eligible residents |
| Time from recording to analysis result | <60 seconds | System logs |
| Nurse engagement with alerts | >90% of red/urgent alerts acknowledged within 24 hours | Alert acknowledgement timestamps |
| Early detection rate | Detect ≥1 condition before clinical presentation in ≥20% of flagged cases within first 12 months | Clinical validation audit |
| False positive rate | <15% of red alerts result in no clinical finding on assessment | Clinical follow-up records |
| Resident satisfaction | ≥80% rate the recording experience as "easy" or "very easy" | Post-recording single-question survey |
| Resident deletion rate | <5% of recordings voluntarily deleted by residents | Database records |

---

## 11. Open questions for clinical advisory

1. What is the minimum recording frequency needed for reliable baseline establishment — monthly or quarterly?
2. Should the system accept recordings from residents with severe dysarthria or aphasia, or exclude them from analysis?
3. What is the clinical governance pathway when a voice biomarker flags urgent stroke risk — does it go through the nurse, or directly to the GP/ambulance?
4. Should family members be notified of voice biomarker alerts, or only clinical staff?
5. How do we validate the AI model's accuracy against clinical outcomes — prospective cohort study or retrospective chart review?
6. What role does the GP play — should they have read access to voice analysis reports?
7. For residents with dementia who cannot create a password — should a carer/nurse set up the account on their behalf?

---

## 12. Phased delivery

| Phase | Scope | Timeline |
|-------|-------|----------|
| Phase 1 — MVP | Recording capture, resident auth, basic acoustic feature extraction, simple baseline comparison (speech rate + pause duration only), manual review by speech pathologist | 8–10 weeks |
| Phase 2 — Full acoustic | Complete acoustic feature set, automated baseline deviation alerts, nurse dashboard integration, alert notifications | 6–8 weeks after Phase 1 |
| Phase 3 — Linguistic analysis | Whisper transcription, linguistic feature extraction, LLM-generated narrative reports, QI integration | 6–8 weeks after Phase 2 |
| Phase 4 — Validation | Clinical validation study with partner facility, model accuracy benchmarking, false positive tuning | 12 weeks (parallel with Phase 3) |
