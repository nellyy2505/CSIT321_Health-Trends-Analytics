"""
CSV Upload: accept facility CSV, analyze with ChatGPT, store in upload history.
Upload history: list, get one, delete one, clear all.
Dashboard data: generate trend charts + AI recommendations from stored analysis.
"""
import csv
import io
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.services.cognito_auth import get_current_user_cognito
from app.services import upload_history_db

router = APIRouter(prefix="/upload-csv", tags=["Upload CSV"])
logger = logging.getLogger(__name__)

MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB

CSV_ANALYSIS_PROMPT = """You are a healthcare data analyst. Analyze the following CSV data from a healthcare facility.

Return ONLY a valid JSON object (no markdown, no code block) with these keys:
- "summary": 2-4 sentences describing what this data is about (e.g. facility type, time period, main metrics).
- "keyMetrics": an object with metric names as keys and numeric or string values (e.g. "Total Patients": 1500, "Average Length of Stay": "4.2 days").
- "trends": an array of 2-6 trend items, each with "name" and "value" (numeric) for charting (e.g. {"name": "Admissions", "value": 120}).

Use English. Keep numbers as numbers where possible for charting."""

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


@router.post("/analyze")
async def upload_and_analyze_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_cognito),
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
    return {
        "uploadId": upload_id,
        "filename": file.filename or "data.csv",
        "analysis": analysis_obj,
        "saved": upload_id is not None,
    }


@router.get("/history", response_model=list)
def list_upload_history(current_user: dict = Depends(get_current_user_cognito)):
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
    current_user: dict = Depends(get_current_user_cognito),
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
    current_user: dict = Depends(get_current_user_cognito),
):
    """Delete one upload."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    ok = upload_history_db.delete_upload(sub, upload_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Upload not found.")
    return {"ok": True}


@router.delete("/history")
def clear_upload_history(current_user: dict = Depends(get_current_user_cognito)):
    """Clear all uploads for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
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
    current_user: dict = Depends(get_current_user_cognito),
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
