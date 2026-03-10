"""
Generate AI recommendations (actions, diet, exercise, risks) from health data.
Used by Health Scan (same flow as image analysis) and by GET /mydata/recommendations.
"""
import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

RECOMMENDATIONS_PROMPT = """You are a helpful health advisor. Based on the following health data, provide DETAILED recommendations in English.

You MUST always provide all four sections below. Each must be at least 3-5 sentences. Never leave any section empty or as one short line.

Reply with ONLY a valid JSON object (no markdown, no code block) with exactly these four keys:

- "actions" (What to do): Give 4-5 concrete steps (e.g. follow up with doctor, avoid triggers, monitor symptoms, get retest). Be specific to the data.

- "diet": (1) What to eat. (2) What to avoid (allergens, intolerances). (3) Optional meal/snack ideas. Write 4-5 sentences.

- "exercise" (Exercise & activity): (1) Type of activity. (2) Frequency and duration. (3) Precautions. Write 4-5 sentences.

- "risks" (Possible risks / conditions): Short, clear summary. 2-4 sentences. Non-alarming.

Use simple language. Be specific."""


def _health_data_to_text(data: dict) -> str:
    """Turn health data dict into text for the LLM."""
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


def generate_recommendations_from_health_data(data: dict[str, Any]) -> dict[str, str]:
    """
    Call OpenAI to generate actions, diet, exercise, risks from health data.
    Returns dict with keys: actions, diet, exercise, risks (empty strings on failure or no key).
    """
    text = _health_data_to_text(data)
    if not text or text.strip() == "No data.":
        return {"actions": "", "diet": "", "exercise": "", "risks": ""}
    if not settings.OPENAI_API_KEY:
        return {"actions": "", "diet": "", "exercise": "", "risks": ""}
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": RECOMMENDATIONS_PROMPT},
                {"role": "user", "content": f"Health data:\n\n{text}"},
            ],
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            return {"actions": "", "diet": "", "exercise": "", "risks": ""}
        out = json.loads(raw)

        def _to_str(val: Any) -> str:
            if val is None:
                return ""
            if isinstance(val, str):
                return val
            if isinstance(val, list):
                return "\n".join(str(x) for x in val) if val else ""
            return str(val)

        return {
            "actions": _to_str(out.get("actions")),
            "diet": _to_str(out.get("diet")),
            "exercise": _to_str(out.get("exercise")),
            "risks": _to_str(out.get("risks")),
        }
    except Exception as e:
        logger.exception("generate_recommendations_from_health_data failed: %s", e)
        return {"actions": "", "diet": "", "exercise": "", "risks": ""}
