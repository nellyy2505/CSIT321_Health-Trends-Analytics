"""
CSV Upload: accept facility CSV, analyze with ChatGPT, store in upload history.
Upload history: list, get one, delete one, clear all.
Dashboard data: generate trend charts + AI recommendations from stored analysis.
"""
import csv
import io
import json
import logging
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.config import settings
from app.services.jwt_auth import get_current_user
from app.services import upload_history_db, care_journey_db

router = APIRouter(prefix="/upload-csv", tags=["Upload CSV"])
logger = logging.getLogger(__name__)

MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB

# QI Platform Dashboard Specification: extract CSV values so the dashboard can be drawn.
CSV_ANALYSIS_PROMPT = """You are a QI (Quality Indicator) data analyst for Australian residential aged care. Analyze the CSV and return ONLY a valid JSON object (no markdown, no code block) that will drive the dashboard.

CSV COLUMNS TO USE (match by name or meaning; names may vary in case/spacing):
- facility_name → page title (e.g. "Sunrise Aged Care — Dashboard")
- quarter_label → quarter selector (e.g. "Q3 2024"); list all unique quarters present (up to 8)
- resident_id → count residents per quarter; identify residents at risk

14 QI INDICATORS (use these column names or equivalents; rate = % of rows where column = 1 unless noted):
1. Pressure injuries: PI_01 → rate = % where PI_01 = 1
2. Falls & major injury: FALL_01, FALL_MAJ → rate = % where FALL_01 = 1
3. Unplanned weight loss: UWL_SIG, UWL_CON → rate = % where UWL_SIG = 1
4. Medications: MED_POLY, MED_AP → rate = % where MED_POLY = 1
5. Activities of daily living: ADL_01 → rate = % where ADL_01 = 1
6. Incontinence care: IC_IAD → rate = % where IC_IAD = 1
7. Restrictive practices: RP_01 → rate = % where RP_01 = 1
8. Hospitalisation: HOSP_ALL → rate = % where HOSP_ALL = 1
9. Allied health: AH_GAP → rate = count where AH_GAP = 1 (gap count per quarter)
10. Consumer experience: CONSUMER_SCORE → rate = average score across residents
11. Quality of life: QOL_SCORE → rate = average score across residents
12. Workforce: WORKFORCE_ADEQUATE → rate = % where WORKFORCE_ADEQUATE = 1
13. Enrolled nursing: EN_DIRECT_CARE_PCT → rate = average % across residents
14. Lifestyle officer: LIFESTYLE_SESSIONS → rate = average sessions per resident

MISSING DATA RULES:
- If a column is missing entirely → set "valueDisplay": "No data", "status": "grey", "ratePerQuarter": [], "trendArrow": null.
- If column exists but all values are 0 → set valueDisplay to "0.0%", status to "green", ratePerQuarter with that 0.
- If only 1 quarter of data → provide that one rate; sparkline will show single point; set trendArrow to null.

TREND ARROW (compare ONLY current quarter rate vs previous quarter rate; two quarters at a time):
- If |currentRate - previousRate| <= 0.5 (or 0.5%): set "trendArrow": "stable".
- LOWER-IS-BETTER indicators (id order 1–9): pi, falls, uwl, meds, adl, incontinence, rp, hosp, allied_health. For these: currentRate > previousRate by >0.5% → "trendArrow": "up" (Worsening); currentRate < previousRate by >0.5% → "trendArrow": "down" (Improving).
- HIGHER-IS-BETTER indicators (id order 10–14): consumer_exp, qol, workforce, enrolled_nursing, lifestyle. For these: currentRate > previousRate by >0.5% → "trendArrow": "down" (Improving); currentRate < previousRate by >0.5% → "trendArrow": "up" (Worsening).

TRAFFIC LIGHT PILL (On track / Monitor / Above threshold) — absolute measure: compare current quarter rate to FIXED thresholds ONLY; has nothing to do with previous quarter.
- For each indicator provide "thresholdAmber" and "thresholdRed" (numbers; use national/typical values if not in CSV, e.g. for % rates often ~5% amber, ~10% red).
- LOWER-IS-BETTER (pi, falls, uwl, meds, adl, incontinence, rp, hosp, allied_health): if currentRate > thresholdRed → "status": "red" (Above threshold); if currentRate between thresholdAmber and thresholdRed → "status": "amber" (Monitor); if currentRate < thresholdAmber → "status": "green" (On track).
- HIGHER-IS-BETTER (consumer_exp, qol, workforce, enrolled_nursing, lifestyle): if currentRate < thresholdRed → "status": "red" (Above threshold); if currentRate between thresholdRed and thresholdAmber → "status": "amber" (Monitor); if currentRate > thresholdAmber → "status": "green" (On track).
- Missing or no data → "status": "grey".

RESIDENTS AT RISK: A resident is "at risk" if flagged on 2+ indicators in the same quarter (e.g. PI_01=1 and FALL_01=1). Return the count and top resident_id list (anonymised labels like "Resident 004" if possible).

Return this exact JSON structure (use null for missing; all arrays use numbers or null):

- "summary": string, 1-3 sentences describing the facility data and time period.
- "header": object with "facilityName" (string), "quarterLabels" (array of up to 8 quarter strings), "residentCountForLatestQuarter" (number).
- "summaryStrip": object with "totalResidents" (number), "categoriesAtRiskCount" (number), "categoriesAtRiskOf" (14), "lastSubmissionDate" (string, e.g. "14 Oct 2024").
- "indicators": array of exactly 14 objects, in this order: Pressure injuries ("pi"), Falls & major injury ("falls"), Unplanned weight loss ("uwl"), Medications ("meds"), Activities of daily living ("adl"), Incontinence care ("incontinence"), Restrictive practices ("rp"), Hospitalisation ("hosp"), Allied health ("allied_health"), Consumer experience ("consumer_exp"), Quality of life ("qol"), Workforce ("workforce"), Enrolled nursing ("enrolled_nursing"), Lifestyle officer ("lifestyle"). Each object: "id", "name", "csvColumns", "ratePerQuarter", "currentRate", "previousRate", "thresholdAmber", "thresholdRed", "status" ("green"|"amber"|"red"|"grey"), "trendArrow" ("up"|"down"|"stable"|null), "valueDisplay".
- "residentsAtRisk": object with "count" (number), "residentIds" (array of strings).
- "keyMetrics": {}.
- "trends": [].

Use English. Output only valid JSON, no markdown."""

CARE_JOURNEY_PROMPT = """You are a healthcare data analyst. Extract care journey data from the following CSV.

COLUMN MAPPING (flexible - match by meaning):
- resident_id / patient_id / id / Resident ID / Patient ID
- resident_name / patient_name / name / Resident Name
- admission: admission_date, Admission Date, date_admission, admit_date
- assessment: assessment_date, Assessment Date, date_assessment
- treatment: treatment_date, Treatment Date, treatment_start, date_treatment
- review: review_date, Review Date, date_review
- discharge: discharge_date, Discharge Date, date_discharge
- risk: risk_level, Risk, risk_level

For each patient/resident row (process all rows up to 500), build timeline with keys: admission, assessment, treatment, review, discharge.
Each stage: { "date": "YYYY-MM-DD" or "", "days": number }. If CSV has only dates, set days to 0 (backend will compute).
If a stage column is missing, use {"date": "", "days": 0}.

Return ONLY valid JSON (no markdown) with key "patients": array of { resident_id, resident_name, risk, timeline }.
If no patient data, return {"patients": []}. Keep strings short."""

DASHBOARD_PROMPT = """You are a healthcare facility analyst. Based on the following facility data analysis, provide:

1) Trend chart data: an array of 4-8 items, each with "name" (string) and "value" (number), suitable for bar/line/radar charts (e.g. patient volume, readmission rate, satisfaction score). Use the key "chartData".

2) Recommendations:
- "trendsComing": 2-4 sentences on trends to watch or emerging patterns.
- "thingsToMonitor": 3-5 bullet points or short paragraphs on what to monitor and improve at this facility.

Return ONLY a valid JSON object (no markdown) with keys: "chartData" (array of {name, value}), "trendsComing" (string), "thingsToMonitor" (string). Use English."""


def _csv_to_text(content: bytes, max_rows: int = 20) -> str:
    """Convert CSV bytes to text for the LLM. Default 20 rows; use max_rows for dashboard extraction."""
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)[:max_rows]
        return "\n".join(",".join(r) for r in rows)
    except Exception:
        return content.decode("utf-8", errors="replace")[:15000]


def _extract_quarter_labels_from_csv(content: bytes) -> list[str]:
    """Parse CSV and return ordered unique quarter labels (e.g. Q1 2024, Q2 2024). Uses same decode/column logic as _compute_dashboard_from_csv."""
    try:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        q_col = _find_col(fieldnames, "quarter_label")
        q_raw = _find_col(fieldnames, "quarter")
        y_raw = _find_col(fieldnames, "year")
        seen: set[str] = set()
        ordered: list[str] = []
        for row in reader:
            label = (row.get(q_col, "") if q_col else "").strip()
            if not label and (q_raw or y_raw):
                q = (row.get(q_raw, "") if q_raw else "").strip()
                y = (row.get(y_raw, "") if y_raw else "").strip()
                if q and y:
                    label = f"{q} {y}"
            if label and label not in seen:
                seen.add(label)
                ordered.append(label)
        return ordered
    except Exception as e:
        logger.warning("_extract_quarter_labels_from_csv failed: %s", e)
        return []


def _csv_to_text_balanced_by_quarter(content: bytes, quarter_labels: list[str], max_per_quarter: int = 50) -> str:
    """Build CSV text with rows from each quarter so the AI sees all quarters. Header + up to max_per_quarter rows per quarter."""
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows_by_quarter: dict[str, list[dict[str, str]]] = {q: [] for q in quarter_labels}
        # Column name for quarter (quarter_label or quarter+year)
        fieldnames = reader.fieldnames or []
        for row in reader:
            label = (row.get("quarter_label") or "").strip()
            if not label and (row.get("quarter") or row.get("year")):
                q = (row.get("quarter") or "").strip()
                y = (row.get("year") or "").strip()
                if q and y:
                    label = f"{q} {y}"
            if label in rows_by_quarter and len(rows_by_quarter[label]) < max_per_quarter:
                rows_by_quarter[label].append(row)
        # Build output: header + rows from each quarter in order (use csv.writer so commas in values are quoted)
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(fieldnames)
        for q in quarter_labels:
            for r in rows_by_quarter.get(q, []):
                writer.writerow([r.get(f, "") for f in fieldnames])
        return out.getvalue()[:120000]
    except Exception as e:
        logger.warning("_csv_to_text_balanced_by_quarter failed: %s", e)
        return _csv_to_text(content, max_rows=300)


def _csv_to_text_for_dashboard(content: bytes, max_rows: int = 120) -> str:
    """Legacy: first N rows. Prefer using quarter-aware balanced text when quarters are known."""
    return _csv_to_text(content, max_rows=max_rows)


# 14 QI cards: column, calculation, display, direction, thresholds (green/amber/red)
# lower_is_better: green below amber_hi, amber between amber_hi and red_hi, red above red_hi
# higher_is_better: green above amber_lo, amber between red_lo and amber_lo, red below red_lo
_QI_CARDS = [
    {"id": "pi", "name": "Pressure injuries", "col": "PI_01", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 6, "red_hi": 10},
    {"id": "falls", "name": "Falls & major injury", "col": "FALL_01", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 8, "red_hi": 12},
    {"id": "uwl", "name": "Unplanned weight loss", "col": "UWL_SIG", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 4, "red_hi": 8},
    {"id": "meds", "name": "Medications", "col": "MED_POLY", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 15, "red_hi": 25},
    {"id": "adl", "name": "Activities of daily living", "col": "ADL_01", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 15, "red_hi": 25},
    {"id": "incontinence", "name": "Incontinence care", "col": "IC_IAD", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 4, "red_hi": 8},
    {"id": "rp", "name": "Restrictive practices", "col": "RP_01", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 4, "red_hi": 8},
    {"id": "hosp", "name": "Hospitalisation", "col": "HOSP_ALL", "calc": "pct_binary", "display": "pct", "lower": True, "amber_hi": 9, "red_hi": 14},
    {"id": "allied_health", "name": "Allied health", "col": "AH_GAP", "calc": "count_binary", "display": "count", "lower": True, "amber_hi": 10, "red_hi": 20},
    {"id": "consumer_exp", "name": "Consumer experience", "col": "CONSUMER_SCORE", "calc": "avg_float", "display": "pct", "lower": False, "red_lo": 60, "amber_lo": 75},
    {"id": "qol", "name": "Quality of life", "col": "QOL_SCORE", "calc": "avg_float", "display": "pct", "lower": False, "red_lo": 55, "amber_lo": 70},
    {"id": "workforce", "name": "Workforce", "col": "WORKFORCE_ADEQUATE", "calc": "pct_binary", "display": "pct", "lower": False, "red_lo": 80, "amber_lo": 90},
    {"id": "enrolled_nursing", "name": "Enrolled nursing", "col": "EN_DIRECT_CARE_PCT", "calc": "avg_float", "display": "pct", "lower": False, "red_lo": 80, "amber_lo": 90},
    {"id": "lifestyle", "name": "Lifestyle officer", "col": "LIFESTYLE_SESSIONS", "calc": "avg_int", "display": "decimal", "lower": False, "red_lo": 1.0, "amber_lo": 2.0},
]


def _find_col(fieldnames: list[str], want: str) -> str | None:
    """Find CSV column by exact or case-insensitive match. Strips BOM and whitespace for comparison; returns original key for row lookup."""
    want_norm = want.strip().replace("\ufeff", "").lower()
    for f in fieldnames:
        fn = (f or "").strip().replace("\ufeff", "").lower()
        if fn == want_norm or (f or "").strip() == want.strip():
            return f  # return original key so row[col] works
    return None


def _safe_binary(row: dict, col: str) -> int:
    """Rule 2: binary columns are string '1'/'0' or number 1/0; treat as 1 only when value equals 1."""
    if not col:
        return 0
    v = row.get(col)
    if v is None or v == "":
        return 0
    s = str(v).strip()
    if s in ("1", "1.0", "1.00"):
        return 1
    try:
        return 1 if int(float(s)) == 1 else 0
    except (ValueError, TypeError):
        return 0


def _safe_float(row: dict, col: str) -> float:
    """Rule 3: float columns - parseFloat before sum."""
    if col not in row:
        return 0.0
    try:
        return float(str(row.get(col) or "0").strip() or "0")
    except (ValueError, TypeError):
        return 0.0


def _safe_int(row: dict, col: str) -> int:
    """Rule 4: integer column for LIFESTYLE_SESSIONS."""
    if col not in row:
        return 0
    try:
        return int(float(str(row.get(col) or "0").strip() or "0"))
    except (ValueError, TypeError):
        return 0


def _compute_dashboard_from_csv(content: bytes, quarter_labels: list[str], facility_name: str) -> dict[str, Any]:
    """Compute 14 QI indicators from CSV using exact rules. Filter by quarter first; binary as number."""
    try:
        text = content.decode("utf-8-sig", errors="replace")  # utf-8-sig strips BOM so first column name is clean
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    except Exception as e:
        logger.warning("_compute_dashboard_from_csv parse failed: %s", e)
        return _empty_dashboard(quarter_labels, facility_name)

    q_col = _find_col(fieldnames, "quarter_label")
    q_raw = _find_col(fieldnames, "quarter")
    y_raw = _find_col(fieldnames, "year")
    res_col = _find_col(fieldnames, "resident_id")
    fn_col = _find_col(fieldnames, "facility_name")

    def quarter_of(row: dict) -> str:
        if q_col and row.get(q_col, "").strip():
            return str(row.get(q_col, "")).strip()
        q = str(row.get(q_raw or "quarter", "")).strip()
        y = str(row.get(y_raw or "year", "")).strip()
        return f"{q} {y}" if q and y else ""

    rows_by_q: dict[str, list[dict]] = {}
    for q in quarter_labels:
        rows_by_q[q] = []
    for row in rows:
        ql = quarter_of(row)
        if ql in rows_by_q:
            rows_by_q[ql].append(row)

    fall_col = _find_col(fieldnames, "FALL_01")
    for q in quarter_labels:
        rq = rows_by_q.get(q, [])
        n = len(rq)
        if n > 0 and fall_col:
            sample_vals = [str(r.get(fall_col, ""))[:20] for r in rq[:3]]
            logger.info("[compute] quarter=%s rows=%d FALL_01 col=%s sample_vals=%s", q, n, fall_col, sample_vals)

    indicators = []
    for card in _QI_CARDS:
        col = _find_col(fieldnames, card["col"])
        values_per_quarter: list[float | int] = []
        for q in quarter_labels:
            rq = rows_by_q.get(q, [])
            n = len(rq)
            if n == 0:
                values_per_quarter.append(None)
                continue
            if card["calc"] == "pct_binary":
                if not col:
                    values_per_quarter.append(None)
                    continue
                count = sum(_safe_binary(r, col) for r in rq)
                pct = round(100.0 * count / n, 1)  # formula: (count of 1s / rows in quarter) * 100
                values_per_quarter.append(pct)
                if card["id"] == "falls":
                    logger.info("[Falls] quarter=%s n=%d count(FALL_01=1)=%d rate=%.1f%%", q, n, count, pct)
            elif card["calc"] == "count_binary":
                if not col:
                    values_per_quarter.append(None)
                    continue
                count = sum(_safe_binary(r, col) for r in rq)
                values_per_quarter.append(count)
            elif card["calc"] == "avg_float":
                if not col:
                    values_per_quarter.append(None)
                    continue
                total = sum(_safe_float(r, col) for r in rq)
                values_per_quarter.append(round(total / n, 1))
            elif card["calc"] == "avg_int":
                if not col:
                    values_per_quarter.append(None)
                    continue
                total = sum(_safe_int(r, col) for r in rq)
                values_per_quarter.append(round(total / n, 1))
            else:
                values_per_quarter.append(None)

        # current = last quarter, previous = second-to-last
        current_rate = values_per_quarter[-1] if values_per_quarter else None
        previous_rate = values_per_quarter[-2] if len(values_per_quarter) >= 2 else None

        # valueDisplay
        if current_rate is None:
            value_display = "N/A"
        elif card["display"] == "pct":
            value_display = f"{current_rate}%"
        elif card["display"] == "count":
            value_display = str(int(current_rate))
        else:
            value_display = f"{current_rate}"

        # trendArrow: 0.5% rule
        trend_arrow = None
        if current_rate is not None and previous_rate is not None:
            diff = (current_rate or 0) - (previous_rate or 0)
            if abs(diff) <= 0.5:
                trend_arrow = "stable"
            else:
                if card["lower"]:
                    trend_arrow = "up" if diff > 0 else "down"
                else:
                    trend_arrow = "down" if diff > 0 else "up"

        # status from fixed thresholds
        status = "grey"
        if current_rate is not None:
            if card["lower"]:
                if current_rate < card["amber_hi"]:
                    status = "green"
                elif current_rate <= card["red_hi"]:
                    status = "amber"
                else:
                    status = "red"
            else:
                # higher is better: green above amber_lo, amber between red_lo and amber_lo, red below red_lo
                rlo = card.get("red_lo", 0)
                alo = card.get("amber_lo", 100)
                if current_rate >= alo:
                    status = "green"
                elif current_rate >= rlo:
                    status = "amber"
                else:
                    status = "red"

        # Rule 5/6: no rows -> N/A; column exists but all 0 -> show 0
        if current_rate is None and any(v is not None for v in values_per_quarter):
            pass  # keep N/A if mixed
        rate_list = [v if v is not None else None for v in values_per_quarter]

        indicators.append({
            "id": card["id"],
            "name": card["name"],
            "ratePerQuarter": rate_list,
            "currentRate": current_rate,
            "previousRate": previous_rate,
            "status": status,
            "trendArrow": trend_arrow,
            "valueDisplay": value_display,
        })

    # Resident count for latest quarter
    latest_q = quarter_labels[-1] if quarter_labels else ""
    latest_rows = rows_by_q.get(latest_q, [])
    resident_count = len(latest_rows)

    # Residents at risk: 2+ flags in same quarter (binary indicators 1-9)
    binary_cols = [_find_col(fieldnames, c["col"]) for c in _QI_CARDS[:9]]
    at_risk_ids: list[str] = []
    for row in latest_rows:
        rid = str(row.get(res_col or "resident_id", "")).strip() if res_col else ""
        if not rid:
            continue
        flags = sum(1 for col in binary_cols if col and _safe_binary(row, col) == 1)
        if flags >= 2:
            at_risk_ids.append(rid if len(rid) < 12 else f"Resident {rid[-3:]}")
    at_risk_ids = at_risk_ids[:15]

    # Categories at risk (red) in latest quarter
    red_count = sum(1 for ind in indicators if ind.get("status") == "red")

    # Last submission date from latest quarter label
    last_sub = latest_q if latest_q else ""

    facility = facility_name or (latest_rows[0].get(fn_col or "facility_name", "Facility") if latest_rows else "Facility")

    return {
        "summary": f"Dashboard computed from CSV for {facility}. {len(quarter_labels)} quarter(s); {resident_count} residents in latest quarter.",
        "header": {
            "facilityName": facility,
            "quarterLabels": quarter_labels,
            "residentCountForLatestQuarter": resident_count,
        },
        "summaryStrip": {
            "totalResidents": resident_count,
            "categoriesAtRiskCount": red_count,
            "categoriesAtRiskOf": 14,
            "lastSubmissionDate": last_sub,
        },
        "indicators": indicators,
        "residentsAtRisk": {"count": len(at_risk_ids), "residentIds": at_risk_ids},
        "keyMetrics": {},
        "trends": [],
    }


def _empty_dashboard(quarter_labels: list[str], facility_name: str) -> dict[str, Any]:
    """Return minimal dashboard when computation fails."""
    return {
        "summary": "No data",
        "header": {"facilityName": facility_name or "Facility", "quarterLabels": quarter_labels, "residentCountForLatestQuarter": 0},
        "summaryStrip": {"totalResidents": 0, "categoriesAtRiskCount": 0, "categoriesAtRiskOf": 14, "lastSubmissionDate": ""},
        "indicators": [
            {"id": c["id"], "name": c["name"], "ratePerQuarter": [], "currentRate": None, "previousRate": None, "status": "grey", "trendArrow": None, "valueDisplay": "N/A"}
            for c in _QI_CARDS
        ],
        "residentsAtRisk": {"count": 0, "residentIds": []},
        "keyMetrics": {},
        "trends": [],
    }


def _csv_to_text_for_care_journey(content: bytes, max_rows: int = 500) -> str:
    """Convert CSV to text for care journey extraction. Sends more rows than _csv_to_text."""
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)[:max_rows]
        return "\n".join(",".join(r) for r in rows)
    except Exception:
        return content.decode("utf-8", errors="replace")[:100000]


def _call_chatgpt(system_prompt: str, user_content: str, max_tokens: int = 2000) -> dict[str, Any]:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured.")
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
    )
    raw = (resp.choices[0].message.content or "").strip()
    if not raw:
        return {}
    return json.loads(raw)


def _parse_date(s: str) -> datetime | None:
    """Parse YYYY-MM-DD or similar date string. Returns None if invalid."""
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s[:10], fmt)
        except ValueError:
            continue
    return None


def _compute_durations_from_dates(normalized: dict[str, dict]) -> dict[str, dict]:
    """When days is 0 but we have dates, compute duration from date differences."""
    stages = ["admission", "assessment", "treatment", "review", "discharge"]
    result = dict(normalized)
    for i, stage in enumerate(stages):
        meta = result.get(stage) or {}
        days = meta.get("days") or 0
        if days > 0:
            continue
        date_str = meta.get("date") or ""
        if not date_str:
            continue
        dt = _parse_date(date_str)
        if not dt:
            continue
        # next stage's date
        next_date_str = ""
        if i + 1 < len(stages):
            next_meta = result.get(stages[i + 1]) or {}
            next_date_str = next_meta.get("date") or ""
        if next_date_str:
            next_dt = _parse_date(next_date_str)
            if next_dt and next_dt >= dt:
                days = (next_dt - dt).days
                result[stage] = {**meta, "days": max(0, days)}
    return result


def _extract_care_journey_from_csv(content: bytes) -> list[dict]:
    """Parse CSV directly for care journey data. Fallback when ChatGPT fails or returns empty."""
    date_cols = [
        ("admission", ["admission_date", "admission date", "date_admission", "admit_date"]),
        ("assessment", ["assessment_date", "assessment date", "date_assessment"]),
        ("treatment", ["treatment_date", "treatment date", "date_treatment", "treatment_start"]),
        ("review", ["review_date", "review date", "date_review"]),
        ("discharge", ["discharge_date", "discharge date", "date_discharge"]),
    ]
    id_cols = ["resident_id", "patient_id", "id", "resident id", "patient id"]
    name_cols = ["resident_name", "patient_name", "name", "resident name", "patient name"]
    risk_cols = ["risk", "risk_level", "risk level"]
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)[:500]
        if not rows:
            return []
        headers_lower = {h.strip().lower(): h for h in rows[0].keys() if h}

        def find_col(candidates):
            def norm(s):
                return s.lower().replace(" ", "").replace("_", "")
            for c in candidates:
                cn = norm(c)
                for h, orig in headers_lower.items():
                    if norm(h) == cn or norm(orig) == cn:
                        return orig
            return None

        rid_col = find_col(id_cols)
        name_col = find_col(name_cols)
        risk_col = find_col(risk_cols)
        if not rid_col:
            return []

        stage_cols = {}
        for stage, candidates in date_cols:
            col = find_col(candidates)
            if col:
                stage_cols[stage] = col

        patients = []
        for row in rows:
            rid = str(row.get(rid_col, "") or "").strip()
            if not rid:
                continue
            name = str(row.get(name_col or rid_col, "") or rid).strip()
            risk = str(row.get(risk_col, "") or "Low").strip() or "Low"
            timeline = {}
            for stage, col in stage_cols.items():
                val = str(row.get(col, "") or "").strip()
                timeline[stage] = {"date": val, "days": 0}
            for s in ["admission", "assessment", "treatment", "review", "discharge"]:
                if s not in timeline:
                    timeline[s] = {"date": "", "days": 0}
            patients.append({"resident_id": rid, "resident_name": name, "risk": risk, "timeline": timeline})
        return patients
    except Exception as e:
        logger.warning("Direct CSV care journey parse failed: %s", e)
        return []


def _parse_json_from_content(content: str) -> dict[str, Any]:
    """Extract JSON from model response (handles markdown, extra text, truncation)."""
    if not content or not content.strip():
        return {}
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()
    start = content.find("{")
    if start == -1:
        return {}
    depth = 0
    end = -1
    for i in range(start, len(content)):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return {}
    try:
        return json.loads(content[start : end + 1])
    except json.JSONDecodeError:
        return {}


@router.post("/analyze")
async def upload_and_analyze_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a CSV file, analyze with ChatGPT, store in history. Returns uploadId, filename, analysis."""
    logger.info("[upload-csv] Step 1: Received request — filename=%s", file.filename)
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV.")
    content = await file.read()
    logger.info("[upload-csv] Step 2: Read file — size=%d bytes (%.2f KB)", len(content), len(content) / 1024)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="CSV must be under 5 MB.")
    # Extract quarter labels from full CSV so we show all quarters (Q1–Q4) on dashboard
    quarter_labels = _extract_quarter_labels_from_csv(content)
    logger.info("[upload-csv] Step 2b: Quarters in CSV — %s", quarter_labels)
    if not quarter_labels:
        raise HTTPException(status_code=400, detail="CSV has no quarter data (need quarter_label or quarter+year).")
    # Compute 14 QI indicators from CSV using exact rules (no AI for numbers)
    try:
        analysis_obj = _compute_dashboard_from_csv(content, quarter_labels, "")
        logger.info("[upload-csv] Step 3: Dashboard computed from CSV — indicators=%d", len(analysis_obj.get("indicators", [])))
    except Exception as e:
        logger.warning("Dashboard computation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Could not compute dashboard: {str(e)}") from e
    analysis_str = json.dumps(analysis_obj)

    csv_content = content.decode("utf-8", errors="replace")
    upload_id = None
    try:
        upload_id = upload_history_db.put_upload(
            sub, file.filename or "data.csv", analysis_str, csv_content=csv_content
        )
        logger.info("[upload-csv] Step 5: Saved to storage — uploadId=%s, analysisLen=%d", upload_id, len(analysis_str))
    except Exception as e:
        logger.warning("Save upload failed (table may not exist): %s", e)
        # Still return analysis so Upload Data works without the history table (e.g. local dev)

    # Extract care journey data for Care Journey Flow (aged care manager)
    if upload_id:
        patients = []
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": CARE_JOURNEY_PROMPT},
                        {"role": "user", "content": f"CSV data:\n\n{_csv_to_text_for_care_journey(content)}"},
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=16000,
                )
                raw = (resp.choices[0].message.content or "").strip()
                journey_out = {}
                if raw:
                    try:
                        journey_out = json.loads(raw)
                    except json.JSONDecodeError:
                        journey_out = _parse_json_from_content(raw)
                patients = journey_out.get("patients") or []
            except Exception as e:
                logger.warning("Care journey ChatGPT extraction failed: %s", e)

        if (not patients or not isinstance(patients, list)) and content:
            patients = _extract_care_journey_from_csv(content)
            if patients:
                logger.info("[upload_and_analyze_csv] fallback: direct CSV parse found %d patients", len(patients))

        if isinstance(patients, list) and patients:
            try:
                for p in patients[:500]:
                    rid = str(p.get("resident_id") or p.get("patient_id") or "").strip()
                    if not rid:
                        continue
                    name = str(p.get("resident_name") or p.get("name") or rid).strip()
                    risk = str(p.get("risk") or "Low").strip() or "Low"
                    tl = p.get("timeline") or {}
                    stages = ["admission", "assessment", "treatment", "review", "discharge"]
                    normalized = {}
                    for s in stages:
                        stage_data = tl.get(s) if isinstance(tl, dict) else {}
                        if isinstance(stage_data, dict):
                            d = str(stage_data.get("date") or "").strip()
                            normalized[s] = {
                                "date": d or "",
                                "days": int(stage_data.get("days") or 0) if stage_data.get("days") is not None else 0,
                            }
                        else:
                            normalized[s] = {"date": "", "days": 0}
                    normalized = _compute_durations_from_dates(normalized)
                    care_journey_db.put_journey(sub, upload_id, rid, name, risk, normalized)
                logger.info("[upload-csv] Step 6: Care journey stored — count=%d, uploadId=%s", min(len(patients), 500), upload_id)
            except Exception as e:
                logger.warning("Care journey save failed (table may not exist): %s", e)

    payload = {
        "uploadId": upload_id,
        "filename": file.filename or "data.csv",
        "analysis": analysis_obj,
        "saved": upload_id is not None,
    }
    logger.info("[upload-csv] Step 7: Sending response — uploadId=%s, filename=%s, saved=%s", upload_id, payload["filename"], payload["saved"])
    return payload


@router.get("/history", response_model=list)
def list_upload_history(current_user: dict = Depends(get_current_user)):
    """List all CSV uploads for the current user."""
    logger.info("[upload-csv] GET /history — request received")
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    items = upload_history_db.list_uploads(sub)
    out = [{"uploadId": u["uploadId"], "filename": u["filename"], "uploadedAt": u["uploadedAt"]} for u in items]
    logger.info("[upload-csv] GET /history — response: count=%d", len(out))
    return out


@router.get("/history/{upload_id}/download", response_class=Response)
def download_upload_csv(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Download the CSV file for an upload. Returns stored CSV content or analysis as text if CSV not stored."""
    logger.info("[upload-csv] GET /history/%s/download — request received", upload_id)
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = upload_history_db.get_upload(sub, upload_id)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    filename = (u.get("filename") or "data").rstrip(".csv") + ".csv"
    csv_content = u.get("csv_content")
    logger.info("[upload-csv] GET /history/%s/download — response: filename=%s, hasCsvContent=%s", upload_id, filename, bool(csv_content))
    if csv_content:
        return Response(
            content=csv_content.encode("utf-8"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    # Fallback: return analysis as text for older uploads without stored CSV
    analysis = u.get("analysis") or ""
    if isinstance(analysis, dict):
        import json as _json
        analysis = _json.dumps(analysis, indent=2)
    return Response(
        content=analysis.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}.analysis.txt"'},
    )


@router.get("/history/{upload_id}")
def get_upload_by_id(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get one upload's full data (including analysis). csv_content omitted; use download endpoint for file."""
    logger.info("[upload-csv] GET /history/%s — request received", upload_id)
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = upload_history_db.get_upload(sub, upload_id)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    out = {k: v for k, v in u.items() if k != "csv_content"}
    logger.info("[upload-csv] GET /history/%s — response: keys=%s, hasAnalysis=%s", upload_id, list(out.keys()), "analysis" in out)
    return out


@router.delete("/history/{upload_id}")
def delete_upload_by_id(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete one upload and its Care Journey records."""
    logger.info("[upload-csv] DELETE /history/%s — request received", upload_id)
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    ok = upload_history_db.delete_upload(sub, upload_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Upload not found.")
    care_journey_db.delete_journeys_by_upload(sub, upload_id)
    logger.info("[upload-csv] DELETE /history/%s — response: ok=True", upload_id)
    return {"ok": True}


@router.delete("/history")
def clear_upload_history(current_user: dict = Depends(get_current_user)):
    """Clear all uploads and their Care Journey records for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    items = upload_history_db.list_uploads(sub)
    for u in items:
        uid = u.get("uploadId")
        if uid:
            care_journey_db.delete_journeys_by_upload(sub, uid)
    count = upload_history_db.clear_all_uploads(sub)
    return {"deleted": count}


class DashboardRequest(BaseModel):
    uploadId: str


class DashboardResponse(BaseModel):
    chartData: list[dict[str, Any]]
    trendsComing: str
    thingsToMonitor: str


@router.post("/dashboard", response_model=DashboardResponse)
def get_dashboard_data(
    body: DashboardRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate trend chart data and AI recommendations from a stored CSV upload."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = upload_history_db.get_upload(sub, body.uploadId)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    analysis_str = u.get("analysis") or ""
    if isinstance(analysis_str, dict):
        analysis_str = json.dumps(analysis_str)
    if not analysis_str.strip():
        return DashboardResponse(chartData=[], trendsComing="", thingsToMonitor="No analysis available.")
    try:
        out = _call_chatgpt(DASHBOARD_PROMPT, f"Facility data analysis:\n\n{analysis_str}", max_tokens=1500)
    except Exception as e:
        logger.warning("Dashboard generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Could not generate dashboard: {str(e)}") from e
    chart_data = out.get("chartData") or []
    if not isinstance(chart_data, list):
        chart_data = []
    chart_data = [{"name": str(x.get("name", "")), "value": float(x.get("value", 0)) if x.get("value") is not None else 0} for x in chart_data]

    def _to_str(v: Any) -> str:
        """Normalize AI output: string as-is, list -> joined with newlines."""
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        if isinstance(v, list):
            return "\n".join(str(x).strip() for x in v if x is not None and str(x).strip())
        return str(v).strip()

    return DashboardResponse(
        chartData=chart_data,
        trendsComing=_to_str(out.get("trendsComing")),
        thingsToMonitor=_to_str(out.get("thingsToMonitor")),
    )
