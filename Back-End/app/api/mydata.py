"""
My Data API: get/save health data (patient, clinical, trend) per user.
Stored in DynamoDB keyed by Cognito sub. Auth required.
Includes AI-generated recommendations (what to do, diet, risks) from ChatGPT.
"""
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services.cognito_auth import get_current_user_cognito
from app.services import health_data_db

router = APIRouter(prefix="/mydata", tags=["My Data"])
logger = logging.getLogger(__name__)


def _stringify_dict(d: dict | None) -> dict[str, str]:
    """Ensure all values are strings for DynamoDB."""
    if not d:
        return {}
    return {k: (v if isinstance(v, str) else str(v)) for k, v in d.items()}


class RecommendationsPayload(BaseModel):
    actions: str = ""
    diet: str = ""
    exercise: str = ""
    risks: str = ""


def _rec_value_to_str(v: Any) -> str:
    """Convert recommendation value to string (handles nested dicts from AI, e.g. diet: {what_to_eat, what_to_avoid})."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        parts = [f"{k}: {_rec_value_to_str(val)}" for k, val in v.items() if val is not None and str(val).strip()]
        return "\n".join(parts) if parts else ""
    return str(v).strip() if v else ""


class MyDataBody(BaseModel):
    keyInformation: dict[str, Any] = {}
    patientContext: dict[str, Any] = {}
    clinicalMeasurements: dict[str, Any] = {}
    trendAndRisk: dict[str, Any] = {}
    recommendations: dict[str, Any] | RecommendationsPayload | None = None


class SettingsBody(BaseModel):
    """User and facility settings. All fields optional."""
    avatar: str = ""
    firstName: str = ""
    lastName: str = ""
    jobTitle: str = ""
    facilityName: str = ""
    facilityType: str = ""
    facilityRegistration: str = ""
    abn: str = ""
    street: str = ""
    suburb: str = ""
    state: str = ""
    postcode: str = ""
    bedCapacity: str = ""
    contactEmail: str = ""
    contactPhone: str = ""
    emergencyContact: str = ""
    delegatedContact: str = ""
    afterHoursContact: str = ""


@router.get("/settings")
def get_settings(current_user: dict = Depends(get_current_user_cognito)):
    """Get user/facility settings. Returns empty dict if none stored."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return health_data_db.get_settings(sub)
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            raise HTTPException(
                status_code=503,
                detail="Storage not available. Create the DynamoDB table.",
            ) from e
        raise HTTPException(status_code=503, detail="Storage temporarily unavailable.") from e


@router.put("/settings")
def save_settings(
    body: SettingsBody,
    current_user: dict = Depends(get_current_user_cognito),
):
    """Save user/facility settings. Persists across devices."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    settings = body.model_dump()
    try:
        health_data_db.put_settings(sub, settings)
        return {"ok": True}
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            raise HTTPException(
                status_code=503,
                detail="Storage not available. Create the DynamoDB table.",
            ) from e
        raise HTTPException(status_code=503, detail="Storage temporarily unavailable.") from e


@router.get("", response_model=MyDataBody)
def get_my_data(current_user: dict = Depends(get_current_user_cognito)):
    """Return stored My Data for the current user. Empty sections if none saved."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = health_data_db.get_health_data(sub)
    if data is None:
        return MyDataBody()
    rec = data.pop("recommendations", None)
    body = MyDataBody(**data)
    if isinstance(rec, dict) and rec:
        body.recommendations = RecommendationsPayload(
            actions=rec.get("actions") or "",
            diet=rec.get("diet") or "",
            exercise=rec.get("exercise") or "",
            risks=rec.get("risks") or "",
        )
    return body


@router.put("", response_model=MyDataBody)
def save_my_data(
    body: MyDataBody,
    current_user: dict = Depends(get_current_user_cognito),
):
    """Save My Data for the current user. Overwrites existing."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    key_info = _stringify_dict(body.keyInformation)
    patient_ctx = _stringify_dict(body.patientContext)
    clinical = _stringify_dict(body.clinicalMeasurements)
    trend = _stringify_dict(body.trendAndRisk)
    rec = None
    if body.recommendations:
        r = body.recommendations
        if isinstance(r, dict):
            rec = {
                "actions": _rec_value_to_str(r.get("actions")),
                "diet": _rec_value_to_str(r.get("diet")),
                "exercise": _rec_value_to_str(r.get("exercise")),
                "risks": _rec_value_to_str(r.get("risks")),
            }
        else:
            rec = {
                "actions": (r.actions or "").strip(),
                "diet": (r.diet or "").strip(),
                "exercise": (r.exercise or "").strip(),
                "risks": (r.risks or "").strip(),
            }
    try:
        health_data_db.put_health_data(sub, key_info, patient_ctx, clinical, trend, recommendations=rec)
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            raise HTTPException(
                status_code=503,
                detail="My Data storage is not available. Create the DynamoDB table (e.g. CareDataHealthData-dev) in your AWS account. See Back-End/CREATE-HEALTH-DATA-TABLE.md",
            ) from e
        raise HTTPException(status_code=503, detail="My Data storage temporarily unavailable.") from e
    out = MyDataBody(keyInformation=key_info, patientContext=patient_ctx, clinicalMeasurements=clinical, trendAndRisk=trend)
    if rec:
        out.recommendations = RecommendationsPayload(**rec)
    return out


class RecommendationsResponse(BaseModel):
    actions: str = ""
    diet: str = ""
    exercise: str = ""
    risks: str = ""
    chartSuggestions: dict | None = None  # { "radar": [], "bar": [], "line": [] } key names for charts


def _health_data_to_text(data: dict) -> str:
    """Turn stored health data into a short text summary for the LLM."""
    parts = []
    for section_name, section in [
        ("Key information", data.get("keyInformation") or {}),
        ("Patient context", data.get("patientContext") or data.get("patient") or {}),
        ("Clinical measurements", data.get("clinicalMeasurements") or data.get("clinical") or {}),
        ("Trend and risk", data.get("trendAndRisk") or data.get("trend") or {}),
    ]:
        if not section or not isinstance(section, dict):
            continue
        items = [f"  {k}: {v}" for k, v in section.items() if v is not None and str(v).strip()]
        if items:
            parts.append(f"{section_name}:\n" + "\n".join(items))
    return "\n\n".join(parts) if parts else "No data."


# Personal/demographic keys — never send to chart suggestions (charts = health data only)
_PERSONAL_KEY_LOWER = frozenset({
    "age", "year of birth", "date of birth", "dob", "yob", "birth year", "birth date",
    "height", "weight", "bmi", "sex", "gender", "patient name", "name", "birth", "years old",
    "address", "phone", "id", "patient id",
})


def _is_personal_key(key: str) -> bool:
    lower = (key or "").strip().lower()
    if lower in _PERSONAL_KEY_LOWER:
        return True
    if "year of birth" in lower or "date of birth" in lower or "patient name" in lower:
        return True
    return False


def _numeric_keys_from_data(data: dict) -> list[str]:
    """Return numeric keys that are health data only (no personal info) for chart suggestions."""
    keys = []
    for section in [
        data.get("keyInformation") or {},
        data.get("patientContext") or data.get("patient") or {},
        data.get("clinicalMeasurements") or data.get("clinical") or {},
        data.get("trendAndRisk") or data.get("trend") or {},
    ]:
        if not isinstance(section, dict):
            continue
        for k, v in section.items():
            if v is None or not str(v).strip() or _is_personal_key(k):
                continue
            try:
                n = float(str(v).strip())
                if n != n or not (-1e9 < n < 1e9):
                    continue
                keys.append(k)
            except ValueError:
                pass
    return keys


RECOMMENDATIONS_PROMPT = """You are a helpful health advisor. Based on the following health data from the user's record, provide DETAILED, personalized recommendations in English.

CRITICAL: You MUST always fill all four sections (actions, diet, exercise, risks). Each must be at least 4-5 sentences. Never leave any section empty or as one short line.

Reply with ONLY a valid JSON object (no markdown, no code block) with exactly these five keys:

- "actions" (What to do): More concrete steps. Include 4-5 specific actions: e.g. follow-up with a doctor or specialist, avoid specific allergens or triggers, monitor certain symptoms, get a retest or further tests. Be specific to the lab values and findings in the data.

- "diet": (1) What to eat: specific foods, nutrients, or meal patterns. (2) What to avoid: allergens, intolerances, foods to limit. (3) Optional: simple meal or snack ideas. Write 4-5 sentences.

- "exercise" (Exercise & activity): (1) Type: e.g. walking, swimming, strength, flexibility. (2) Frequency and duration (e.g. 3-4 times per week, 20-30 min). (3) Precautions or activities to avoid. Write 4-5 sentences.

- "risks": Possible health conditions or risks suggested by the data (e.g. allergy to X, risk of Y, or “results are within normal range”). Keep it clear and non-alarming. If everything is normal, say so and mention what to monitor. Short, clear summary. 2-4 sentences. Non-alarming.

- "chartSuggestions": An object with three arrays: "radar", "bar", "line". Each array must contain key names chosen ONLY from the "Numeric keys for charts" list in the user message. Do NOT include Age, Year of birth, Date of birth, Sex, Patient name, Height, Weight, BMI. Include only lab values, test results, vitals. Pick 4-6 best keys per chart. Use exact key names from the list.

Use simple language. Be specific. Make every section long enough to be genuinely useful."""


@router.get("/recommendations", response_model=RecommendationsResponse)
def get_recommendations(current_user: dict = Depends(get_current_user_cognito)):
    """Get AI-generated recommendations (what to do, diet, risks) from the user's stored health data."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    data = health_data_db.get_health_data(sub)
    text = _health_data_to_text(data or {})
    numeric_keys = _numeric_keys_from_data(data or {})
    if not data or text.strip() == "No data.":
        return RecommendationsResponse(
            actions="Add health data in My Data or run a Health Scan to get personalized recommendations.",
            diet="",
            exercise="",
            risks="",
        )

    if not settings.OPENAI_API_KEY:
        return RecommendationsResponse(
            actions="Recommendations are not configured (missing API key).",
            diet="",
            exercise="",
            risks="",
        )

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        user_content = f"Health data:\n\n{text}\n\nNumeric keys for charts (use only these in chartSuggestions):\n" + ", ".join(numeric_keys) if numeric_keys else f"Health data:\n\n{text}"
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": RECOMMENDATIONS_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            raise ValueError("Empty response from model")
        out = json.loads(raw)
        cs = out.get("chartSuggestions")
        if isinstance(cs, dict):
            cs = {
                "radar": list(cs.get("radar") or [])[:8],
                "bar": list(cs.get("bar") or [])[:8],
                "line": list(cs.get("line") or [])[:8],
            }
        else:
            cs = None

        def _to_str(val: Any) -> str:
            if val is None:
                return ""
            if isinstance(val, str):
                return val
            if isinstance(val, list):
                return "\n".join(str(x) for x in val) if val else ""
            return str(val)

        return RecommendationsResponse(
            actions=_to_str(out.get("actions")),
            diet=_to_str(out.get("diet")),
            exercise=_to_str(out.get("exercise")),
            risks=_to_str(out.get("risks")),
            chartSuggestions=cs,
        )
    except Exception as e:
        logger.warning("Recommendations API failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Could not generate recommendations: {str(e)}") from e
