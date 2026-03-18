# Australian Aged Care Quality Indicator Program
# Official Sources, Data Structures & National Benchmarks

Prepared: March 2026 | Regulatory alignment: QI Program Manual 4.0 (effective 1 April 2025)

---

## 1. How data actually gets submitted to the government

This is the end-to-end data pipeline from bedside assessment to government system. There is no paper submission. Everything goes through a digital platform.

### Step 1 — Facility staff collect data (bedside / clinical records)

Clinical staff (RNs, ENs, PCWs) perform assessments at the bedside or review clinical records as specified for each indicator. They record individual resident-level data using one of two approaches:

- **Government Excel template** — The Department publishes a downloadable .xlsx data recording template for each QI category. Section 2 of the template captures individual resident data (one row per resident). Section 1 auto-calculates the aggregate counts the facility needs to type into GPMS. The template has built-in formulas so staff just fill in raw assessment results and the totals compute automatically.
  - Source: https://www.health.gov.au/resources/publications/qi-program-data-recording-templates

- **Facility's own system** — Facilities can use their own clinical software, spreadsheets, or templates as long as they follow the Manual 4.0 definitions exactly. Many larger providers use commercial aged care software (e.g., Leecare, Autumn Care, AlayaCare) that has QI data collection built in.

### Step 2 — Data entry into GPMS (Government Provider Management System)

The facility enters aggregate data into GPMS via one of three methods:

**Method A — Manual data entry (most common for single sites)**
The Quality Manager or DON logs into the GPMS web portal, opens the Quality Indicators application, and manually types in the aggregate numbers for each indicator. The GPMS presents a web form with specific numeric fields per indicator (detailed in Section 2 below). This is a web-based form — not a file upload.

**Method B — Excel bulk upload (for multi-site providers)**
Providers operating multiple homes can download the GPMS file upload template (.xlsx), populate one row per service, and upload the entire file through the GPMS bulk upload function. This template has validation rules and date formatting built in. Commercial benchmarking companies also use this method to submit on behalf of their clients.
  - Source: https://www.health.gov.au/resources/publications/qi-program-file-upload-template

**Method C — API submission (for software vendors)**
Third-party aged care software vendors can submit directly to GPMS via the Quality Indicators API. This is used by commercial software providers who build QI reporting into their clinical systems.

**Deadline**: 11:59pm AEST on the 21st day of the month following quarter end.

### Step 3 — Government processing

The Department of Health, Disability and Ageing processes and validates the submitted data, then supplies it to the Australian Institute of Health and Welfare (AIHW). The AIHW publishes national quarterly reports on the GEN Aged Care Data website.

### Step 4 — Compliance monitoring

The Aged Care Quality and Safety Commission uses QI data alongside other regulatory information to monitor service quality and trigger compliance actions where needed.

Sources:
- Dept of Health, Disability and Ageing, "How the QI Program works" — https://www.health.gov.au/our-work/qi-program/how-the-program-works
- GPMS User Guide: Quality Indicators application — https://www.health.gov.au/resources/publications/gpms-user-guide-quality-indicators
- GPMS changes summary (November 2025) — https://www.health.gov.au/sites/default/files/2025-10/summary-of-my-aged-care-and-government-provider-management-system-gpms-changes-november-2025_0.pdf

---

## 2. Exact fields submitted per indicator in GPMS

These are the aggregate numeric values that get typed into the GPMS web form (or uploaded via bulk template) for each indicator, each quarter. Every field is a whole number. No individual resident names or IDs are submitted to the government — only counts.

### QI 1 — Pressure injuries

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Number of eligible residents who were assessed | Integer |
| Residents excluded — no consent | Number who withheld consent | Integer |
| Residents excluded — absent | Number absent from service entire quarter | Integer |
| Residents with ≥1 PI (any stage) | Count meeting criteria | Integer |
| Residents with Stage 1 PI | Count | Integer |
| Residents with Stage 2 PI | Count | Integer |
| Residents with Stage 3 PI | Count | Integer |
| Residents with Stage 4 PI | Count | Integer |
| Residents with Unstageable PI | Count | Integer |
| Residents with Suspected DTI | Count | Integer |
| PIs acquired inside service | Count (additional reporting) | Integer |
| PIs acquired outside service | Count (additional reporting) | Integer |
| Assessment date | Date the PI observation was conducted | Date |

Note: A resident with multiple PI stages (e.g., one Stage 1 and one Stage 3) is counted once in the "any stage" total but counted in each applicable stage row. The staging counts can therefore sum to more than the headline count.

### QI 2 — Restrictive practices

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Eligible residents over the 3-day window | Integer |
| Residents excluded — absent | Absent for entire 3-day period | Integer |
| Residents subject to any RP | Count (excluding chemical restraint) | Integer |
| Residents — mechanical restraint | Count | Integer |
| Residents — physical restraint | Count | Integer |
| Residents — environmental restraint | Count | Integer |
| Residents — seclusion | Count | Integer |
| RP exclusively via secure area | Count (additional reporting) | Integer |
| 3-day assessment start date | First day of the 3-day window | Date |
| 3-day assessment end date | Last day of the 3-day window | Date |

### QI 3 — Unplanned weight loss

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed (significant) | Eligible for significant UWL | Integer |
| Total residents assessed (consecutive) | Eligible for consecutive UWL | Integer |
| Residents excluded — no consent | Withheld consent to be weighed | Integer |
| Residents excluded — end-of-life | Receiving end-of-life care | Integer |
| Residents excluded — missing weights | Missing required weight records | Integer |
| Residents with significant UWL (≥5%) | Count | Integer |
| Residents with consecutive UWL | Count (loss every month × 3 months) | Integer |

### QI 4 — Falls and major injury

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Eligible residents for the quarter | Integer |
| Residents excluded — absent | Absent entire quarter | Integer |
| Residents with ≥1 fall | Count | Integer |
| Residents with fall + major injury | Count (subset of above) | Integer |

### QI 5 — Medication management

| Field | Description | Data type |
|-------|-------------|-----------|
| Total assessed — polypharmacy | Eligible on census date | Integer |
| Residents excluded — in hospital (poly) | In hospital on census date | Integer |
| Residents with ≥9 medications | Count | Integer |
| Polypharmacy collection date | The census date chosen | Date |
| Total assessed — antipsychotics | Eligible in 7-day window | Integer |
| Residents excluded — in hospital (AP) | In hospital entire 7-day period | Integer |
| Residents — AP with psychosis diagnosis | Count | Integer |
| Residents — AP without psychosis diagnosis | Count | Integer |
| 7-day assessment end date | End of antipsychotic review period | Date |

### QI 6 — Activities of daily living (Barthel Index)

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Eligible with both current and previous scores | Integer |
| Residents excluded — end-of-life | Receiving end-of-life care | Integer |
| Residents excluded — absent | Absent entire quarter | Integer |
| Residents excluded — no prior score | No previous quarter Barthel score | Integer |
| Residents with ADL decline (≥1 point) | Count | Integer |
| Residents with zero prior score | Count (additional reporting) | Integer |

### QI 7 — Incontinence care

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Eligible assessed for incontinence | Integer |
| Residents excluded — absent | Absent entire quarter | Integer |
| Residents with incontinence | Count | Integer |
| Residents with IAD (any category) | Count (denominator = those with incontinence) | Integer |
| IAD Category 1A | Persistent redness, no infection | Integer |
| IAD Category 1B | Persistent redness, with infection | Integer |
| IAD Category 2A | Skin loss, no infection | Integer |
| IAD Category 2B | Skin loss, with infection | Integer |

### QI 8 — Hospitalisation

| Field | Description | Data type |
|-------|-------------|-----------|
| Total residents assessed | Eligible for the quarter | Integer |
| Residents excluded — absent | Absent entire quarter | Integer |
| Residents with ≥1 ED presentation | Count | Integer |
| Residents with ≥1 ED or hospital admission | Count (superset of above) | Integer |

### QI 9 — Workforce

| Field | Description | Data type |
|-------|-------------|-----------|
| Step 1 — staff last quarter (per role) | Headcount who worked any hours in previous quarter | Integer × 4 roles |
| Step 2 — staff at start of current quarter (per role) | Subset of Step 1 who worked ≥120 hours last quarter | Integer × 4 roles |
| Step 3 — staff who stopped (per role) | Subset of Step 2 with ≥60-day gap in current quarter | Integer × 4 roles |

Roles: Service managers, RNs/NPs, ENs, PCW/AINs

### QI 10 — Consumer experience

| Field | Description | Data type |
|-------|-------------|-----------|
| Total offered assessment | Residents offered the QoCE-ACC survey | Integer |
| Completed — self | Independently completed | Integer |
| Completed — interviewer facilitated | Assisted by interviewer | Integer |
| Completed — proxy | Completed by family/carer | Integer |
| Residents excluded — no consent | Chose not to complete | Integer |
| Residents excluded — absent | Absent during assessment period | Integer |
| Score band: Excellent (22–24) | Count | Integer |
| Score band: Good (19–21) | Count | Integer |
| Score band: Moderate (14–18) | Count | Integer |
| Score band: Poor (8–13) | Count | Integer |
| Score band: Very poor (0–7) | Count | Integer |

### QI 11 — Quality of life

Same structure as QI 10 but using the QoL-ACC instrument.

### QI 12–14 — Enrolled nursing, Allied health, Lifestyle officer

These three staffing QIs are NOT entered through the GPMS Quality Indicators form. The Department extracts the data from the Quarterly Financial Report (QFR), which providers submit separately through a different GPMS application. The one exception is the allied health "recommended services received" data point, which IS entered through the QI application.

| Field (Allied health — QI app only) | Description | Data type |
|--------------------------------------|-------------|-----------|
| Total residents assessed | Eligible for allied health assessment | Integer |
| Residents excluded — absent | Absent entire quarter | Integer |
| Per discipline — recommended in care plan | Count of residents with recommendation | Integer × 7 disciplines |
| Per discipline — service received | Count of residents who received service | Integer × 7 disciplines |

Disciplines: Physiotherapy, OT, Speech pathology, Podiatry, Dietetics, Other AH, AH assistant

Sources:
- QI Program Manual 4.0 — Part A, Sections 8–20 — https://www.health.gov.au/resources/publications/national-aged-care-mandatory-quality-indicator-program-manual-40-part-a
- GPMS User Guide: Quality Indicators application — https://www.health.gov.au/resources/publications/gpms-user-guide-quality-indicators
- QI Program FAQs — https://www.health.gov.au/sites/default/files/2025-10/national-aged-care-quality-indicator-program-faqs_1.pdf
- QI Data recording templates — https://www.health.gov.au/resources/publications/qi-program-data-recording-templates

---

## 3. National benchmark data

All figures below are approximate national prevalence rates compiled from AIHW quarterly reports published between 2021 and 2025. The AIHW reports data for ~2,600 residential aged care services. The "IQR" column shows the interquartile range (25th to 75th percentile) across individual services where published — this is the range within which the middle 50% of facilities sit.

### QI 1–9: Adverse outcome indicators (lower = better)

| Indicator | Code | National avg (approx.) | IQR across services | Trend (17 quarters) |
|-----------|------|----------------------|---------------------|---------------------|
| Pressure injuries (any stage) | PI_01 | 5–6% | 2.8%–8.5% | Significant decrease |
| Restrictive practices | RP_01 | 12–14% | Not published at service level | No significant change |
| Significant UWL (≥5%) | UWL_SIG | 5–6% | Not published | Significant decrease |
| Consecutive UWL | UWL_CON | 4–5% | Not published | Significant decrease |
| Falls (any) | FALL_01 | 30–33% | Not published | No significant change |
| Falls with major injury | FALL_MAJ | 1.5–2.5% | Not published | Significant decrease |
| Polypharmacy (≥9 meds) | MED_POLY | 35–40% | Not published | Significant decrease |
| Antipsychotic use | MED_AP | 18–20% | Not published | Significant decrease |
| ADL decline (≥1 point Barthel) | ADL_01 | 35–40% | Not published | No significant change |
| Incontinence-associated dermatitis | IC_IAD | 6–9% (of those with incontinence) | Not published | No significant change |
| ED presentations | HOSP_ED | 10–14% | Not published | Significant INCREASE |
| ED + hospital admissions | HOSP_ALL | 14–18% | Not published | Significant INCREASE |
| Workforce turnover | WF | Varies by role | Not published | Significant decrease |

### QI 10–14: Desirable outcome indicators (higher = better)

| Indicator | Code | National avg (approx.) | Trend |
|-----------|------|----------------------|-------|
| Consumer experience (Good + Excellent) | CX | 75–82% | Significant improvement |
| Quality of life (Good + Excellent) | QOL | 72–80% | Significant improvement |
| EN care minutes proportion | EN | Newly reported (Q1 2025–26) | Insufficient data |
| Allied health minutes/resident/day | AH | Newly reported (Q1 2025–26) | Insufficient data |
| Lifestyle officer minutes/resident/day | LO | Newly reported (Q1 2025–26) | Insufficient data |

### How to read these benchmarks

The prevalence rate formula used by the AIHW is:

    Prevalence rate (%) = (Residents meeting QI criteria / Total eligible residents assessed) × 100

A facility with a PI rate of 4% when the national average is 5–6% is performing better than average. A facility at 10% is above the 75th percentile and likely to attract regulatory attention.

The AIHW also publishes boxplots showing the full distribution across services (min, 25th percentile, median, 75th percentile, max). These are available in the quarterly reports linked in Section 7.

Sources:
- AIHW, "Residential Aged Care Quality Indicators — July to September 2025" — https://www.gen-agedcaredata.gov.au/resources/publications/2026/february/residential-aged-care-quality-indicators-july-to-september-2025
- AIHW, "Residential Aged Care Quality Indicators — April to June 2025" — https://www.gen-agedcaredata.gov.au/resources/publications/2025/october/residential-aged-care-quality-indicators-april-to-june-2025
- AIHW, "Residential Aged Care Quality Indicators — January to March 2025" — https://www.gen-agedcaredata.gov.au/topics/quality-in-aged-care/residential-aged-care-quality-indicators-latest-release
- AIHW, "Australia's Welfare 2023 — Chapter 8: Measuring Quality in Aged Care" — https://www.aihw.gov.au/getmedia/f897ee10-7d55-4d05-b8c3-97a75547063f/aihw-aus-246_chapter_8.pdf

---

## 4. Assessment methods at a glance

| QI | What staff actually do | When | Assessment window | Consent needed |
|----|----------------------|------|-------------------|----------------|
| Pressure injuries | Full-body skin observation during routine personal care | Same day each quarter | Single point-in-time | Yes |
| Restrictive practices | Review 3 days of clinical records for any RP events | Varied, unpredictable 3-day window per quarter | 3-day retrospective audit | No |
| Unplanned weight loss | Weigh each resident monthly; compare across quarters | Monthly weighing; quarterly comparison | 4 weight measurements (previous quarter + 3 monthly) | Yes |
| Falls and major injury | Review all incident reports for the entire quarter | After quarter ends (within 21 days) | Entire quarter retrospective | No |
| Medication management | Review medication charts on a single census date (poly); 7-day chart review (AP) | Census date chosen each quarter | Single day (poly) + 7-day window (AP) | No |
| ADL | Complete Barthel Index (10 items) based on last 24–48 hours | Once per quarter, around same time | 24–48 hour observation period | No |
| Incontinence care | Visual skin inspection using GLOBIAD tool | Once per quarter, around same time | Single point-in-time observation | No |
| Hospitalisation | Review care records for ED/hospital transfers | After quarter ends (within 21 days) | Entire quarter retrospective | No |
| Workforce | Count staff headcounts and hours by role | End of quarter | Entire quarter | N/A |
| Consumer experience | Administer QoCE-ACC 6-item questionnaire | Once per quarter | Single assessment | Yes (can decline) |
| Quality of life | Administer QoL-ACC 6-item questionnaire | Once per quarter | Single assessment | Yes (can decline) |
| EN / AH / Lifestyle | Extracted from Quarterly Financial Report | Quarterly | Entire quarter (care minutes) | N/A |

---

## 5. Exclusion criteria quick reference

Correct exclusion handling is essential — it affects the denominator and therefore the prevalence rate.

| QI | Exclusion reasons |
|----|-------------------|
| Pressure injuries | No consent for entire quarter; absent entire quarter |
| Restrictive practices | Absent for entire 3-day assessment period |
| UWL (significant) | No consent; end-of-life care; missing previous or finishing weight |
| UWL (consecutive) | No consent; end-of-life care; missing any of the 4 required weights |
| Falls | Absent entire quarter |
| Polypharmacy | In hospital on the collection date |
| Antipsychotics | In hospital for entire 7-day period |
| ADL | End-of-life care; absent entire quarter; no previous quarter Barthel score |
| Incontinence (base) | Absent entire quarter |
| IAD (sub-assessment) | No incontinence (only those with incontinence are assessed for IAD) |
| Hospitalisation | Absent entire quarter |
| Consumer experience | Did not consent to complete survey; absent during assessment |
| Quality of life | Did not consent to complete survey; absent during assessment |

---

## 6. Submission calendar

| Quarter | Covers | Data due by | Key dates |
|---------|--------|-------------|-----------|
| Q1 | 1 Jul – 30 Sep | 21 October, 11:59pm AEST | Falls/hospitalisation record review: Jul–Sep |
| Q2 | 1 Oct – 31 Dec | 21 January, 11:59pm AEDT | Weight: weigh in Oct, Nov, Dec |
| Q3 | 1 Jan – 31 Mar | 21 April, 11:59pm AEST | PI observation: one day in Jan–Mar |
| Q4 | 1 Apr – 30 Jun | 21 July, 11:59pm AEST | RP 3-day audit: 3 days in Apr–Jun |

---

## 7. All cited sources

### Primary regulatory documents

| # | Document | Publisher | URL |
|---|----------|-----------|-----|
| 1 | QI Program Manual 4.0 — Part A (PDF, 133pp) | Dept of Health, Disability and Ageing | https://www.health.gov.au/resources/publications/national-aged-care-mandatory-quality-indicator-program-manual-40-part-a |
| 2 | QI Program Manual 4.0 — Part B | Dept of Health, Disability and Ageing | https://www.health.gov.au/sites/default/files/2025-10/national-aged-care-quality-indicator-program-manual-part-b.pdf |
| 3 | How the QI Program works | Dept of Health, Disability and Ageing | https://www.health.gov.au/our-work/qi-program/how-the-program-works |
| 4 | QI Program data recording templates (.xlsx) | Dept of Health, Disability and Ageing | https://www.health.gov.au/resources/publications/qi-program-data-recording-templates |
| 5 | QI Program file upload template (bulk .xlsx) | Dept of Health, Disability and Ageing | https://www.health.gov.au/resources/publications/qi-program-file-upload-template |
| 6 | GPMS User Guide: Quality Indicators application (PDF, 43pp) | Dept of Health, Disability and Ageing | https://www.health.gov.au/resources/publications/gpms-user-guide-quality-indicators |
| 7 | QI Program FAQs | Dept of Health, Disability and Ageing | https://www.health.gov.au/sites/default/files/2025-10/national-aged-care-quality-indicator-program-faqs_1.pdf |
| 8 | QI Reporting via GPMS — Additional guidance | Dept of Health, Disability and Ageing | https://www.health.gov.au/resources/publications/qi-reporting-via-gpms-additional-guidance |
| 9 | GPMS changes summary (November 2025) | Dept of Health, Disability and Ageing | https://www.health.gov.au/sites/default/files/2025-10/summary-of-my-aged-care-and-government-provider-management-system-gpms-changes-november-2025_0.pdf |
| 10 | About the GPMS | Dept of Health, Disability and Ageing | https://www.health.gov.au/our-work/government-provider-management-system-gpms/about |

### AIHW published data

| # | Document | URL |
|---|----------|-----|
| 11 | QI Report — Jul to Sep 2025 (latest) | https://www.gen-agedcaredata.gov.au/resources/publications/2026/february/residential-aged-care-quality-indicators-july-to-september-2025 |
| 12 | QI Report — Apr to Jun 2025 | https://www.gen-agedcaredata.gov.au/resources/publications/2025/october/residential-aged-care-quality-indicators-april-to-june-2025 |
| 13 | QI Report — Jan to Mar 2025 | https://www.gen-agedcaredata.gov.au/topics/quality-in-aged-care/residential-aged-care-quality-indicators-latest-release |
| 14 | Quality in aged care (GEN topic page) | https://www.gen-agedcaredata.gov.au/topics/quality-in-aged-care |
| 15 | Australia's Welfare 2023 — Chapter 8 | https://www.aihw.gov.au/getmedia/f897ee10-7d55-4d05-b8c3-97a75547063f/aihw-aus-246_chapter_8.pdf |
| 16 | Aged care overview (AIHW) | https://www.aihw.gov.au/reports/australias-welfare/aged-care |

### Regulatory and legislative

| # | Document | URL |
|---|----------|-----|
| 17 | Quality of Care Principles 2014 | https://www.legislation.gov.au/Series/F2014L00830 |
| 18 | ACQSC — Quality indicators | https://www.agedcarequality.gov.au/providers/assessment-monitoring/quality-indicators |

### Academic

| # | Document | URL |
|---|----------|-----|
| 19 | Inacio et al. (2024) "Quality and safety in residential aged care: an evaluation of a national quality indicator programme" | https://pmc.ncbi.nlm.nih.gov/articles/PMC10946472/ |
