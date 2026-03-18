"""
CSV Upload: accept facility CSV, compute QI dashboard (pure Python), store in
upload history + assessment/aggregate/GPMS tables.
Upload history: list, get one, delete one, clear all.
"""
import csv
import io
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.config import settings
from app.services.jwt_auth import get_current_user
from app.services import upload_history_db
from app.services import assessment_db, qi_aggregate_db, gpms_db

router = APIRouter(prefix="/upload-csv", tags=["Upload CSV"])
logger = logging.getLogger(__name__)

MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB

# QI Platform Dashboard Specification: extract CSV values so the dashboard can be drawn.

# GPT prompts removed — dashboard is computed by pure Python _compute_dashboard_from_csv()


def _extract_quarter_labels_from_csv(content: bytes) -> list[str]:
    """Parse CSV and return ordered unique quarter labels.
    Supports three date column patterns (in priority order):
      1. Assessment_Date (ISO YYYY-MM-DD) → converted to 'Q1 2024 (Mar)' style labels
      2. quarter_label column (direct string like 'Q3 2024')
      3. quarter + year columns combined
    """
    try:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        date_col = _find_col(fieldnames, "Assessment_Date")
        q_col = _find_col(fieldnames, "quarter_label")
        q_raw = _find_col(fieldnames, "quarter")
        y_raw = _find_col(fieldnames, "year")
        seen: set[str] = set()
        ordered: list[str] = []
        for row in reader:
            label = ""
            if date_col:
                raw_date = (row.get(date_col) or "").strip()
                if raw_date:
                    label = _date_to_quarter_label(raw_date)
            if not label and q_col:
                label = (row.get(q_col, "") or "").strip()
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



# ─── Date helper ─────────────────────────────────────────────────────────────

def _date_to_quarter_label(date_str: str) -> str:
    """Convert ISO date (YYYY-MM-DD) to quarter label like 'Q1 2024 (Mar)'."""
    try:
        from datetime import date as _date
        d = _date.fromisoformat(date_str.strip())
        quarter = (d.month - 1) // 3 + 1
        month_abbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.month - 1]
        return f"Q{quarter} {d.year} ({month_abbr})"
    except Exception:
        return date_str.strip()


# 14 QI cards: column, calculation, display, direction, thresholds (green/amber/red)
# lower_is_better: green below amber_hi, amber between amber_hi and red_hi, red above red_hi
# higher_is_better: green above amber_lo, amber between red_lo and amber_lo, red below red_lo
# Supports new schema columns (Assessment_Date CSV) as well as legacy column names.
_QI_CARDS = [
    {"id": "pi",             "name": "Pressure injuries",          "col": "PI_01",          "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 6,   "red_hi": 10},
    {"id": "falls",          "name": "Falls & major injury",       "col": "FALL_01",        "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 8,   "red_hi": 12},
    {"id": "uwl",            "name": "Unplanned weight loss",      "col": "UWL_SIG",        "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 4,   "red_hi": 8},
    {"id": "meds",           "name": "Medications",                "col": "MED_POLY",       "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 15,  "red_hi": 25},
    {"id": "adl",            "name": "Activities of daily living", "col": "ADL_01",         "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 15,  "red_hi": 25},
    {"id": "incontinence",   "name": "Incontinence care",          "col": "IC_IAD",         "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 4,   "red_hi": 8},
    {"id": "rp",             "name": "Restrictive practices",      "col": "RP_01",          "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 4,   "red_hi": 8},
    {"id": "hosp",           "name": "Hospitalisation",            "col": "HOSP_ALL",       "calc": "pct_binary",  "display": "pct",     "lower": True,  "amber_hi": 9,   "red_hi": 14},
    # AH gap: % recommended but NOT received (AH_REC_RECOMMENDED=1 AND AH_REC_RECEIVED=0)
    # Fallback: AH_GAP binary column for legacy CSVs
    {"id": "allied_health",  "name": "Allied health",              "col": "AH_REC_RECOMMENDED", "calc": "ah_gap",  "display": "pct",     "lower": True,  "amber_hi": 25,  "red_hi": 40, "col2": "AH_REC_RECEIVED", "col_legacy": "AH_GAP"},
    # CE_01 and QOL_01: composite scores 0–24 (new schema). Legacy: CONSUMER_SCORE / QOL_SCORE as %.
    {"id": "consumer_exp",   "name": "Consumer experience",        "col": "CE_01",          "calc": "avg_float",   "display": "score24", "lower": False, "red_lo": 12,    "amber_lo": 16, "col_legacy": "CONSUMER_SCORE", "legacy_display": "pct", "legacy_red_lo": 60, "legacy_amber_lo": 75},
    {"id": "qol",            "name": "Quality of life",            "col": "QOL_01",         "calc": "avg_float",   "display": "score24", "lower": False, "red_lo": 12,    "amber_lo": 16, "col_legacy": "QOL_SCORE",      "legacy_display": "pct", "legacy_red_lo": 55, "legacy_amber_lo": 70},
    # Workforce: WF_ADEQUATE binary (new) or WORKFORCE_ADEQUATE (legacy)
    {"id": "workforce",      "name": "Workforce",                  "col": "WF_ADEQUATE",    "calc": "pct_binary",  "display": "pct",     "lower": False, "red_lo": 80,    "amber_lo": 90, "col_legacy": "WORKFORCE_ADEQUATE"},
    # Enrolled nursing: EN_DIRECT_PCT float (new) or EN_DIRECT_CARE_PCT (legacy)
    {"id": "enrolled_nursing","name": "Enrolled nursing",          "col": "EN_DIRECT_PCT",  "calc": "avg_float",   "display": "pct",     "lower": False, "red_lo": 80,    "amber_lo": 90, "col_legacy": "EN_DIRECT_CARE_PCT"},
    # Lifestyle: LS_SESSIONS_QTR int (new) or LIFESTYLE_SESSIONS (legacy)
    {"id": "lifestyle",      "name": "Lifestyle officer",          "col": "LS_SESSIONS_QTR","calc": "avg_int",     "display": "decimal", "lower": False, "red_lo": 1.0,   "amber_lo": 2.0,"col_legacy": "LIFESTYLE_SESSIONS"},
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
    """Compute 14 QI indicators from CSV using exact rules. Filter by period first; binary as number.
    Supports Assessment_Date (YYYY-MM-DD), quarter_label, or quarter+year columns for period grouping.
    """
    try:
        text = content.decode("utf-8-sig", errors="replace")  # utf-8-sig strips BOM so first column name is clean
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    except Exception as e:
        logger.warning("_compute_dashboard_from_csv parse failed: %s", e)
        return _empty_dashboard(quarter_labels, facility_name)

    date_col = _find_col(fieldnames, "Assessment_Date")
    q_col = _find_col(fieldnames, "quarter_label")
    q_raw = _find_col(fieldnames, "quarter")
    y_raw = _find_col(fieldnames, "year")
    res_col = _find_col(fieldnames, "resident_id") or _find_col(fieldnames, "Resident_ID")
    fn_col = _find_col(fieldnames, "facility_name")

    def quarter_of(row: dict) -> str:
        if date_col:
            raw_date = (row.get(date_col) or "").strip()
            if raw_date:
                return _date_to_quarter_label(raw_date)
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
        # Resolve column: prefer new schema col, fall back to legacy
        col = _find_col(fieldnames, card["col"])
        if not col and card.get("col_legacy"):
            col = _find_col(fieldnames, card["col_legacy"])
        # For ah_gap: also resolve col2 (AH_REC_RECEIVED) and legacy (AH_GAP)
        col2 = _find_col(fieldnames, card["col2"]) if card.get("col2") else None
        col_legacy = _find_col(fieldnames, card.get("col_legacy", "")) if card.get("col_legacy") else None
        # Detect if CE/QOL is using legacy column (adjust thresholds/display)
        using_legacy = col is None and col_legacy is not None
        if using_legacy and card.get("col_legacy"):
            col = col_legacy

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
                pct = round(100.0 * count / n, 1)
                values_per_quarter.append(pct)
                if card["id"] == "falls":
                    logger.info("[Falls] quarter=%s n=%d count(FALL_01=1)=%d rate=%.1f%%", q, n, count, pct)
            elif card["calc"] == "ah_gap":
                # % recommended but NOT received
                if col and col2:
                    gap = sum(1 for r in rq if _safe_binary(r, col) == 1 and _safe_binary(r, col2) == 0)
                    values_per_quarter.append(round(100.0 * gap / n, 1))
                elif col_legacy:
                    # Legacy: AH_GAP binary count → express as % of n
                    count = sum(_safe_binary(r, col_legacy) for r in rq)
                    values_per_quarter.append(round(100.0 * count / n, 1))
                else:
                    values_per_quarter.append(None)
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

        # valueDisplay — use legacy display if using legacy column
        display_type = card.get("legacy_display", card["display"]) if using_legacy else card["display"]
        if current_rate is None:
            value_display = "N/A"
        elif display_type == "pct":
            value_display = f"{current_rate}%"
        elif display_type == "score24":
            value_display = f"{current_rate}/24"
        elif display_type == "count":
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


def _compute_gpms_fields(content: bytes) -> dict[str, dict[str, Any]]:
    """Compute GPMS aggregate submission fields from resident-level CSV data.
    Groups by Assessment_Date (raw ISO date) and returns {date: {field: value}}.
    Fields match the GPMS form keys used in the frontend Manual Entry form.
    """
    try:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    except Exception as e:
        logger.warning("_compute_gpms_fields parse failed: %s", e)
        return {}

    date_col = _find_col(fieldnames, "Assessment_Date")
    if not date_col:
        return {}

    # Group rows by raw date
    by_date: dict[str, list[dict]] = {}
    for row in rows:
        d = (row.get(date_col) or "").strip()
        if d:
            by_date.setdefault(d, []).append(row)

    def _sum_bin(rq, col_name):
        c = _find_col(fieldnames, col_name)
        if not c:
            return None
        return sum(_safe_binary(r, c) for r in rq)

    def _sum_ternary_eq(rq, col_name, target):
        c = _find_col(fieldnames, col_name)
        if not c:
            return None
        count = 0
        for r in rq:
            try:
                v = int(float(str(r.get(c) or "0").strip() or "0"))
                if v == target:
                    count += 1
            except (ValueError, TypeError):
                pass
        return count

    def _score_band(rq, col_name, lo, hi):
        c = _find_col(fieldnames, col_name)
        if not c:
            return None
        count = 0
        for r in rq:
            try:
                v = float(str(r.get(c) or "").strip() or "0")
                if lo <= v <= hi:
                    count += 1
            except (ValueError, TypeError):
                pass
        return count

    result = {}
    for date_str, rq in sorted(by_date.items()):
        n = len(rq)
        entry = {}

        # QI 1 — Pressure injuries
        entry["pi_total"] = n
        entry["pi_any"] = _sum_bin(rq, "PI_01")
        entry["pi_s1"] = _sum_bin(rq, "PI_S1")
        entry["pi_s2"] = _sum_bin(rq, "PI_S2")
        entry["pi_s3"] = _sum_bin(rq, "PI_S3")
        entry["pi_s4"] = _sum_bin(rq, "PI_S4")
        entry["pi_unstage"] = _sum_bin(rq, "PI_US")
        entry["pi_dti"] = _sum_bin(rq, "PI_DTI")

        # QI 2 — Restrictive practices
        entry["rp_total"] = n
        entry["rp_any"] = _sum_bin(rq, "RP_01")

        # QI 3 — Unplanned weight loss
        entry["uwl_total_sig"] = n
        entry["uwl_total_con"] = n
        entry["uwl_sig"] = _sum_bin(rq, "UWL_SIG")
        entry["uwl_con"] = _sum_bin(rq, "UWL_CON")

        # QI 4 — Falls
        entry["falls_total"] = n
        entry["falls_any"] = _sum_bin(rq, "FALL_01")
        entry["falls_major"] = _sum_bin(rq, "FALL_MAJ")

        # QI 5 — Medications
        entry["poly_total"] = n
        entry["poly_count"] = _sum_bin(rq, "MED_POLY")
        entry["ap_total"] = n
        # AP: MED_AP ternary — 1=with dx, 2=without dx; any >0 is "received an antipsychotic"
        ap_with = _sum_ternary_eq(rq, "MED_AP", 1)
        ap_without = _sum_ternary_eq(rq, "MED_AP", 2)
        entry["ap_any"] = (ap_with or 0) + (ap_without or 0) if ap_with is not None else None
        entry["ap_with_dx"] = ap_with

        # QI 6 — ADL
        entry["adl_total"] = n
        entry["adl_decline"] = _sum_bin(rq, "ADL_01")

        # QI 7 — Incontinence
        entry["ic_total"] = n
        entry["ic_iad_any"] = _sum_bin(rq, "IC_IAD")
        entry["ic_iad_1a"] = _sum_bin(rq, "IC_IAD_1A")
        entry["ic_iad_1b"] = _sum_bin(rq, "IC_IAD_1B")
        entry["ic_iad_2a"] = _sum_bin(rq, "IC_IAD_2A")
        entry["ic_iad_2b"] = _sum_bin(rq, "IC_IAD_2B")

        # QI 8 — Hospitalisation
        entry["hosp_total"] = n
        entry["hosp_ed"] = _sum_bin(rq, "HOSP_ED")
        entry["hosp_all"] = _sum_bin(rq, "HOSP_ALL")

        # QI 10 — Consumer experience (CE_01 is 0-24 score)
        entry["cx_excellent"] = _score_band(rq, "CE_01", 22, 24)
        entry["cx_good"] = _score_band(rq, "CE_01", 19, 21)
        entry["cx_moderate"] = _score_band(rq, "CE_01", 14, 18)
        entry["cx_poor"] = _score_band(rq, "CE_01", 8, 13)
        entry["cx_very_poor"] = _score_band(rq, "CE_01", 0, 7)

        # QI 11 — Quality of life (QOL_01 is 0-24 score)
        entry["qol_excellent"] = _score_band(rq, "QOL_01", 22, 24)
        entry["qol_good"] = _score_band(rq, "QOL_01", 19, 21)
        entry["qol_moderate"] = _score_band(rq, "QOL_01", 14, 18)
        entry["qol_poor"] = _score_band(rq, "QOL_01", 8, 13)
        entry["qol_very_poor"] = _score_band(rq, "QOL_01", 0, 7)

        # QI 13 — Allied health
        entry["ah_total"] = n
        entry["ah_rcv_physio"] = _sum_bin(rq, "AH_RCVD_PHYSIO")
        entry["ah_rcv_ot"] = _sum_bin(rq, "AH_RCVD_OT")
        entry["ah_rcv_speech"] = _sum_bin(rq, "AH_RCVD_SPEECH")
        entry["ah_rcv_pod"] = _sum_bin(rq, "AH_RCVD_POD")
        entry["ah_rcv_diet"] = _sum_bin(rq, "AH_RCVD_DIET")
        entry["ah_rcv_assist"] = _sum_bin(rq, "AH_RCVD_ASSIST")
        entry["ah_rcv_other"] = _sum_bin(rq, "AH_RCVD_OTHER")

        # Strip None values
        result[date_str] = {k: v for k, v in entry.items() if v is not None}

    return result


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


def _extract_rows_by_date(content: bytes) -> dict[str, list[dict]]:
    """Parse CSV and return rows grouped by raw Assessment_Date (ISO YYYY-MM-DD).
    Each row is a dict of fieldname->value from the CSV.
    """
    try:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        date_col = _find_col(fieldnames, "Assessment_Date")
        if not date_col:
            return {}
        by_date: dict[str, list[dict]] = {}
        for row in reader:
            d = (row.get(date_col) or "").strip()
            if d:
                by_date.setdefault(d, []).append(dict(row))
        return by_date
    except Exception as e:
        logger.warning("_extract_rows_by_date failed: %s", e)
        return {}


def _date_to_label_map(content: bytes) -> dict[str, str]:
    """Build a mapping from raw ISO date to quarter label (e.g., '2024-03-31' -> 'Q1 2024 (Mar)')."""
    try:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = list(reader.fieldnames or [])
        date_col = _find_col(fieldnames, "Assessment_Date")
        if not date_col:
            return {}
        mapping: dict[str, str] = {}
        for row in reader:
            raw_date = (row.get(date_col) or "").strip()
            if raw_date and raw_date not in mapping:
                mapping[raw_date] = _date_to_quarter_label(raw_date)
        return mapping
    except Exception:
        return {}


@router.post("/analyze")
async def upload_and_analyze_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a CSV file, compute dashboard, store in history."""
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
    # Extract period labels from CSV (supports Assessment_Date ISO, quarter_label, or quarter+year columns)
    quarter_labels = _extract_quarter_labels_from_csv(content)
    logger.info("[upload-csv] Step 2b: Period labels in CSV — %s", quarter_labels)
    if not quarter_labels:
        # If no date/quarter column found, treat entire file as a single period
        quarter_labels = ["Q1 2024"]
        logger.info("[upload-csv] No date column found — treating as single period: %s", quarter_labels)
    # Compute 14 QI indicators from CSV using exact rules (no AI for numbers)
    try:
        analysis_obj = _compute_dashboard_from_csv(content, quarter_labels, "")
        logger.info("[upload-csv] Step 3: Dashboard computed from CSV — indicators=%d", len(analysis_obj.get("indicators", [])))
    except Exception as e:
        logger.warning("Dashboard computation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Could not compute dashboard: {str(e)}") from e
    analysis_str = json.dumps(analysis_obj)

    # Compute GPMS aggregate fields for Manual Entry pre-fill
    gpms_fields = {}
    try:
        gpms_fields = _compute_gpms_fields(content)
        logger.info("[upload-csv] Step 3b: GPMS fields computed — dates=%s", list(gpms_fields.keys()))
    except Exception as e:
        logger.warning("GPMS fields computation failed (non-fatal): %s", e)

    # --- Store in uploadhistory (audit trail — metadata only) ---
    rows_by_date = _extract_rows_by_date(content)
    date_label_map = _date_to_label_map(content)
    raw_dates = sorted(rows_by_date.keys())
    total_rows = sum(len(v) for v in rows_by_date.values())

    upload_id = None
    try:
        upload_id = upload_history_db.put_upload(
            sub, file.filename or "data.csv", analysis_str,
        )
        logger.info("[upload-csv] Step 4: Upload history saved — uploadId=%s", upload_id)
    except Exception as e:
        logger.warning("Save upload history failed: %s", e)

    # --- Store resident-level assessments in assessments table ---
    if upload_id and rows_by_date:
        for iso_date, date_rows in rows_by_date.items():
            try:
                assessment_db.put_assessments(sub, iso_date, date_rows, upload_id)
            except Exception as e:
                logger.warning("put_assessments failed for date=%s: %s", iso_date, e)
        logger.info("[upload-csv] Step 5: Assessments stored — dates=%d, totalRows=%d", len(raw_dates), total_rows)

    # --- Store pre-computed QI aggregates (per-date snapshots) ---
    if upload_id:
        indicators = analysis_obj.get("indicators", [])
        summary_strip = analysis_obj.get("summaryStrip", {})
        residents_at_risk = analysis_obj.get("residentsAtRisk", {})
        facility_name = analysis_obj.get("header", {}).get("facilityName", "")
        for qi, iso_date in enumerate(raw_dates):
            ql = date_label_map.get(iso_date, iso_date)
            n_residents = len(rows_by_date.get(iso_date, []))
            # Create per-date indicator snapshot: currentRate = this date's rate
            date_indicators = []
            for ind in indicators:
                rpq = ind.get("ratePerQuarter", [])
                date_rate = rpq[qi] if qi < len(rpq) else ind.get("currentRate")
                prev_rate = rpq[qi - 1] if qi > 0 and qi - 1 < len(rpq) else None
                # Recalculate trend for this specific date
                date_trend = None
                if date_rate is not None and prev_rate is not None:
                    diff = (date_rate or 0) - (prev_rate or 0)
                    card = next((c for c in _QI_CARDS if c["id"] == ind["id"]), None)
                    if card:
                        if abs(diff) <= 0.5:
                            date_trend = "stable"
                        elif card["lower"]:
                            date_trend = "up" if diff > 0 else "down"
                        else:
                            date_trend = "down" if diff > 0 else "up"
                # Recalculate status for this specific date
                date_status = "grey"
                if date_rate is not None:
                    card = next((c for c in _QI_CARDS if c["id"] == ind["id"]), None)
                    if card:
                        if card["lower"]:
                            if date_rate < card["amber_hi"]:
                                date_status = "green"
                            elif date_rate <= card["red_hi"]:
                                date_status = "amber"
                            else:
                                date_status = "red"
                        else:
                            rlo = card.get("red_lo", 0)
                            alo = card.get("amber_lo", 100)
                            if date_rate >= alo:
                                date_status = "green"
                            elif date_rate >= rlo:
                                date_status = "amber"
                            else:
                                date_status = "red"
                # Build display value
                date_display = ind.get("valueDisplay", "N/A")
                if date_rate is not None:
                    disp = ind.get("valueDisplay", "")
                    if disp.endswith("%"):
                        date_display = f"{date_rate}%"
                    elif "/24" in disp:
                        date_display = f"{date_rate}/24"
                    else:
                        date_display = str(date_rate)
                date_indicators.append({
                    **ind,
                    "currentRate": date_rate,
                    "previousRate": prev_rate,
                    "status": date_status,
                    "trendArrow": date_trend,
                    "valueDisplay": date_display,
                })
            # Compute per-date summary
            date_red_count = sum(1 for di in date_indicators if di.get("status") == "red")
            date_summary = {
                "totalResidents": n_residents,
                "categoriesAtRiskCount": date_red_count,
                "categoriesAtRiskOf": 14,
                "lastSubmissionDate": ql,
            }
            try:
                qi_aggregate_db.put_aggregate(
                    sub=sub,
                    assessment_date=iso_date,
                    quarter_label=ql,
                    total_residents=n_residents,
                    indicators=date_indicators,
                    summary_strip=date_summary,
                    residents_at_risk=residents_at_risk if qi == len(raw_dates) - 1 else {"count": 0, "residentIds": []},
                    upload_id=upload_id,
                    facility_name=facility_name,
                )
            except Exception as e:
                logger.warning("put_aggregate failed for date=%s: %s", iso_date, e)
        logger.info("[upload-csv] Step 6: QI aggregates stored for %d dates", len(raw_dates))

    # --- Store GPMS fields ---
    if upload_id and gpms_fields:
        for iso_date, fields in gpms_fields.items():
            try:
                gpms_db.put_gpms(sub, iso_date, fields, source="csv_upload", upload_id=upload_id)
            except Exception as e:
                logger.warning("put_gpms failed for date=%s: %s", iso_date, e)
        logger.info("[upload-csv] Step 6b: GPMS fields stored for %d dates", len(gpms_fields))

    payload = {
        "uploadId": upload_id,
        "filename": file.filename or "data.csv",
        "analysis": analysis_obj,
        "saved": upload_id is not None,
        "gpmsFields": gpms_fields,
    }
    logger.info("[upload-csv] Step 7: Sending response — uploadId=%s, filename=%s, saved=%s", upload_id, payload["filename"], payload["saved"])
    return payload


@router.get("/gov-template", response_class=Response)
def download_gov_template():
    """Serve the official government QI data recording template (.xlsx)."""
    import pathlib
    template_path = pathlib.Path(__file__).resolve().parent.parent.parent / "synthesizeData" / "qi-program-data-recording-templates.xlsx"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Government template file not found on server.")
    content = template_path.read_bytes()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="qi-program-data-recording-templates.xlsx"'},
    )


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
    logger.info("[upload-csv] DELETE /history/%s — response: ok=True", upload_id)
    return {"ok": True}


@router.delete("/history")
def clear_upload_history(current_user: dict = Depends(get_current_user)):
    """Clear all uploads for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    count = upload_history_db.clear_all_uploads(sub)
    return {"deleted": count}


