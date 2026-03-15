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
from pydantic import BaseModel

from app.core.config import settings
from app.services.jwt_auth import get_current_user
from app.services import upload_history_db, care_journey_db

router = APIRouter(prefix="/upload-csv", tags=["Upload CSV"])
logger = logging.getLogger(__name__)

MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB

CSV_ANALYSIS_PROMPT = """You are a healthcare data analyst. Analyze the following CSV data from a healthcare facility.

Return ONLY a valid JSON object (no markdown, no code block) with these keys:
- "summary": 2-4 sentences describing what this data is about (e.g. facility type, time period, main metrics).
- "keyMetrics": an object with metric names as keys and numeric or string values (e.g. "Total Patients": 1500, "Average Length of Stay": "4.2 days").
- "trends": an array of 2-6 trend items, each with "name" and "value" (numeric) for charting (e.g. {"name": "Admissions", "value": 120}).

Use English. Keep numbers as numbers where possible for charting."""

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


def _csv_to_text(content: bytes) -> str:
    """Convert CSV bytes to a short text preview for the LLM (first 20 rows, truncated)."""
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)[:20]
        return "\n".join(",".join(r) for r in rows)
    except Exception:
        return content.decode("utf-8", errors="replace")[:15000]


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
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV.")
    content = await file.read()
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="CSV must be under 5 MB.")
    csv_text = _csv_to_text(content)
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="CSV is empty or unreadable.")
    try:
        analysis_obj = _call_chatgpt(CSV_ANALYSIS_PROMPT, f"CSV data:\n\n{csv_text}")
        analysis_str = json.dumps(analysis_obj)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("CSV analysis failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Analysis failed: {str(e)}") from e

    upload_id = None
    try:
        upload_id = upload_history_db.put_upload(sub, file.filename or "data.csv", analysis_str)
        logger.info("[upload_and_analyze_csv] saved upload sub=%s uploadId=%s", sub[:20] + "..." if len(sub) > 20 else sub, upload_id)
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
                logger.info("[upload_and_analyze_csv] stored %d care journeys for uploadId=%s", min(len(patients), 500), upload_id)
            except Exception as e:
                logger.warning("Care journey save failed (table may not exist): %s", e)

    return {
        "uploadId": upload_id,
        "filename": file.filename or "data.csv",
        "analysis": analysis_obj,
        "saved": upload_id is not None,
    }


@router.get("/history", response_model=list)
def list_upload_history(current_user: dict = Depends(get_current_user)):
    """List all CSV uploads for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    items = upload_history_db.list_uploads(sub)
    logger.info("[list_upload_history] sub=%s count=%d", sub[:20] + "..." if len(sub) > 20 else sub, len(items))
    # Return minimal for list (no full analysis to keep payload small)
    return [{"uploadId": u["uploadId"], "filename": u["filename"], "uploadedAt": u["uploadedAt"]} for u in items]


@router.get("/history/{upload_id}")
def get_upload_by_id(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get one upload's full data (including analysis)."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = upload_history_db.get_upload(sub, upload_id)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    return u


@router.delete("/history/{upload_id}")
def delete_upload_by_id(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete one upload and its Care Journey records."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    ok = upload_history_db.delete_upload(sub, upload_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Upload not found.")
    care_journey_db.delete_journeys_by_upload(sub, upload_id)
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
