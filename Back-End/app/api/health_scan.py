"""
Health Scan: accept image upload, call OpenAI Vision to extract health data.
Returns flexible JSON with 4 sections: keyInformation, patientContext, clinicalMeasurements, trendAndRisk.
Each section is a key-value object; content varies by document type. All text in English.
"""

import base64
import json
import logging
import re
from typing import Any, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.services.cognito_auth import get_current_user_cognito
from app.services.recommendations import generate_recommendations_from_health_data
from app.services import scan_history_db

router = APIRouter(prefix="/health-scan", tags=["Health Scan"])
logger = logging.getLogger(__name__)


# ----------------------------
# Response: 4 flexible sections (each is dict of string -> string)
# ----------------------------
class HealthScanResponse(BaseModel):
    keyInformation: dict[str, str] = {}
    patientContext: dict[str, str] = {}
    clinicalMeasurements: dict[str, str] = {}
    trendAndRisk: dict[str, str] = {}
    recommendations: dict[str, str] | None = None  # actions, diet, exercise, risks (from same-flow AI)
    debug: dict[str, Any] | None = None  # optional: promptSent for frontend to show prompt


# ----------------------------
# Prompt: 4 sections, flexible content
# ----------------------------
SYSTEM_PROMPT = """You are a medical document analyst. Extract health information from the image(s) of health records.
If multiple images are provided, combine all information into ONE unified JSON (one patient/summary view). The document(s) may be in ANY language (e.g. Vietnamese, Chinese, Spanish). Read them, then output ALL text in ENGLISH in the JSON.

Return ONLY a single valid JSON object (no markdown, no code block) with exactly these 4 keys. Each key is an object where both keys and values are strings. The CONTENT of each section is flexible: include whatever fits the document. Use clear label-style keys (e.g. "Test type", "Total IgE", "Blood pressure").

{
  "keyInformation": {
    "<label>": "<value>",
    "<label>": "<value>",
    ...
  },
  "patientContext": {
    "<label>": "<value>",
    ...
  },
  "clinicalMeasurements": {
    "<label>": "<value>",
    ...
  },
  "trendAndRisk": {
    "<label>": "<value>",
    ...
  }
}

Section guidelines (content is flexible; use whatever the document contains):
- keyInformation: Main facts at a glance (e.g. Test type, Test date, Total IgE, Reference range, Notable finding, Summary). For lab/allergy reports put test name, date, key results, interpretation here.
- patientContext: Demographics and history (e.g. Age, Sex, Known conditions, Current medication, Height, Weight, BMI, Smoking, Alcohol). Omit if not in the document.
- clinicalMeasurements: Vitals and lab values (e.g. Blood pressure, Heart rate, Temperature, SpO2, specific test results with units). Omit if not in the document.
- trendAndRisk: Trend, severity, symptoms, interpretation (e.g. Recency, Trend, Severity, Abnormal count, Symptoms, Interpretation). Omit if not in the document.

Rules:
- All text in the JSON must be in English (translate if the document is in another language). Keep numbers and units as-is (e.g. 85 kU/L, 128/82 mmHg).
- Each section must be an object. Use empty object {} for a section that has no relevant content. Put at least something in keyInformation whenever possible (e.g. a brief summary or test name).
- Keys within each section can be anything that fits (e.g. "Test type", "Dog Epithelium (kU/L)", "Interpretation"). Use human-readable labels.
- Return ONLY the JSON object. No markdown. No extra text.
"""


# ----------------------------
# Helpers
# ----------------------------
def _parse_json_from_content(content: str) -> dict[str, Any]:
    """Extract JSON from model response (in case there is extra text)."""
    if not content or not content.strip():
        raise json.JSONDecodeError("Empty response", "", 0)

    content = content.strip()

    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()

    start = content.find("{")
    if start == -1:
        raise json.JSONDecodeError("No JSON object in response", content[:80], 0)

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
        raise json.JSONDecodeError("Unclosed JSON object", content[:80], 0)

    snippet = content[start : end + 1]
    return json.loads(snippet)


def _to_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return v.strip()
    return str(v).strip() if v else ""


def _flexible_section(obj: Any) -> dict[str, str]:
    """Convert a section (object) to dict[str, str]. Keys and values become strings."""
    if not obj or not isinstance(obj, dict):
        return {}
    return {_to_str(k): _to_str(v) for k, v in obj.items() if _to_str(k)}


def _normalize_response(raw: dict) -> HealthScanResponse:
    # Accept new keys or legacy patient/clinical/trend for backward compatibility
    key_info = raw.get("keyInformation") or {}
    patient_ctx = raw.get("patientContext") or raw.get("patient") or {}
    clinical = raw.get("clinicalMeasurements") or raw.get("clinical") or {}
    trend = raw.get("trendAndRisk") or raw.get("trend") or {}

    return HealthScanResponse(
        keyInformation=_flexible_section(key_info),
        patientContext=_flexible_section(patient_ctx),
        clinicalMeasurements=_flexible_section(clinical),
        trendAndRisk=_flexible_section(trend),
    )


# ----------------------------
# Endpoint
# ----------------------------
MAX_IMAGES = 5
MAX_IMAGE_SIZE_MB = 10

@router.post("/analyze", response_model=HealthScanResponse)
async def analyze_health_record(
    images: List[UploadFile] = File(..., description="1 to 5 health record images"),
    current_user: dict = Depends(get_current_user_cognito),
) -> HealthScanResponse:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Health Scan is not configured (OPENAI_API_KEY missing).",
        )

    if not images or len(images) > MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Send between 1 and {MAX_IMAGES} images.",
        )

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    data_urls: List[str] = []
    for img in images:
        if img.content_type and img.content_type.lower() not in allowed:
            raise HTTPException(status_code=400, detail="All files must be images (JPEG, PNG, WEBP, GIF).")
        data = await img.read()
        if len(data) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Each image must be under {MAX_IMAGE_SIZE_MB} MB.")
        media_type = img.content_type or "image/jpeg"
        b64 = base64.b64encode(data).decode("ascii")
        data_urls.append(f"data:{media_type};base64,{b64}")

    user_text = "Return ONLY the JSON object exactly matching the schema above. No markdown."
    user_content: List[dict] = [{"type": "text", "text": user_text}]
    for url in data_urls:
        user_content.append({"type": "image_url", "image_url": {"url": url}})

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        model = "gpt-4o-mini"  # same family as ChatGPT UI; supports vision + JSON
        logger.info("Calling OpenAI Chat Completions (model=%s) for health scan with %d image(s)...", model, len(data_urls))
        logger.info("[Health Scan] Prompt sent to OpenAI (full): system=%s", SYSTEM_PROMPT)
        logger.info("[Health Scan] Prompt sent to OpenAI (full): user_text=%s | images: %d attachment(s)", user_text, len(data_urls))

        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )

        raw_text = ""
        if resp.choices and len(resp.choices) > 0:
            msg = resp.choices[0].message
            if getattr(msg, "content", None):
                raw_text = (msg.content or "").strip()
        if not raw_text:
            logger.warning("OpenAI returned no content. Full response: %s", resp.model_dump() if hasattr(resp, "model_dump") else str(resp)[:500])
            raise HTTPException(status_code=502, detail="No analysis result from provider (empty response).")

        logger.info("OpenAI raw response length=%d preview=%s", len(raw_text), raw_text[:200] if raw_text else "")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("OpenAI API call failed")
        raise HTTPException(status_code=502, detail=f"Analysis failed (OpenAI error): {str(e)}")

    try:
        raw = _parse_json_from_content(raw_text)
        out = _normalize_response(raw)
    except Exception as e:
        logger.warning("Invalid analysis format: %s. Response preview: %s", e, raw_text[:600])
        raise HTTPException(status_code=502, detail=f"Invalid analysis format: {str(e)}")

    # Generate recommendations in the same flow; on failure still return health data with empty recs
    try:
        data_dict = {
            "keyInformation": out.keyInformation,
            "patientContext": out.patientContext,
            "clinicalMeasurements": out.clinicalMeasurements,
            "trendAndRisk": out.trendAndRisk,
        }
        rec = generate_recommendations_from_health_data(data_dict)
        if not (rec.get("actions") or rec.get("diet") or rec.get("exercise") or rec.get("risks")):
            logger.warning("Recommendations generation returned all empty. Check OPENAI_API_KEY and logs above.")
        out.recommendations = rec
    except Exception as e:
        logger.warning("Recommendations generation failed (health data still returned): %s", e)
        out.recommendations = {"actions": "", "diet": "", "exercise": "", "risks": ""}
    out.debug = {"promptSent": {"system": SYSTEM_PROMPT, "userText": user_text}}

    # Record in scan history for Uploaded History page
    sub = current_user.get("sub")
    if sub:
        try:
            summary_parts = []
            for k, v in (out.keyInformation or {}).items():
                if v and len(str(v)) < 100:
                    summary_parts.append(f"{k}: {v}")
            summary = " | ".join(summary_parts)[:500] if summary_parts else "Health record scan"
            scan_history_db.put_scan(sub, len(images), summary)
        except Exception as e:
            logger.warning("Scan history record failed (continuing): %s", e)

    return out


@router.get("/history", response_model=list)
def list_scan_history(current_user: dict = Depends(get_current_user_cognito)):
    """List all Health Scan records for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    items = scan_history_db.list_scans(sub)
    logger.info("[list_scan_history] sub=%s count=%d", sub[:20] + "..." if len(sub) > 20 else sub, len(items))
    return items


@router.delete("/history/{scan_id}")
def delete_scan_by_id(
    scan_id: str,
    current_user: dict = Depends(get_current_user_cognito),
):
    """Delete one Health Scan record."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    ok = scan_history_db.delete_scan(sub, scan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return {"ok": True}


@router.delete("/history")
def clear_scan_history(current_user: dict = Depends(get_current_user_cognito)):
    """Clear all Health Scan records for the current user."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    count = scan_history_db.clear_all_scans(sub)
    return {"deleted": count}