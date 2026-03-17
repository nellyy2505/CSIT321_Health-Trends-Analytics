"""
Store and retrieve My Data (health scan text) per user in DynamoDB.
Keyed by Cognito sub. Text only; no images (cost-effective).
"""
import os
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("HEALTH_DATA_TABLE_NAME", "CareDataHealthData-dev")


def _get_table():
    return boto3.resource("dynamodb").Table(TABLE_NAME)


def _to_json_friendly(obj):
    """Convert DynamoDB types (e.g. Decimal) to JSON-serializable types."""
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _to_json_friendly(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_friendly(v) for v in obj]
    return obj


def get_health_data(sub: str) -> dict | None:
    """Get stored health data for user. Returns None if not found."""
    try:
        r = _get_table().get_item(Key={"sub": sub})
        item = r.get("Item")
        if not item:
            return None
        # Support both new 4-section and legacy 3-section format
        result = {
            "keyInformation": _to_json_friendly(item.get("keyInformation") or item.get("key_information") or {}),
            "patientContext": _to_json_friendly(item.get("patientContext") or item.get("patient") or {}),
            "clinicalMeasurements": _to_json_friendly(item.get("clinicalMeasurements") or item.get("clinical") or {}),
            "trendAndRisk": _to_json_friendly(item.get("trendAndRisk") or item.get("trend") or {}),
        }
        rec = item.get("recommendations")
        if isinstance(rec, dict):
            result["recommendations"] = _to_json_friendly(rec)
        return result
    except ClientError:
        return None


def get_settings(sub: str) -> dict:
    """Get user/facility settings. Returns empty dict if none stored."""
    try:
        r = _get_table().get_item(Key={"sub": sub})
        item = r.get("Item")
        if not item:
            return {}
        settings = item.get("settings")
        if isinstance(settings, dict):
            return _to_json_friendly(settings)
        return {}
    except ClientError:
        return {}


def put_settings(sub: str, settings: dict) -> None:
    """Save user/facility settings. Uses update_item (creates item if not exists)."""
    _get_table().update_item(
        Key={"sub": sub},
        UpdateExpression="SET settings = :s, updated_at = :t",
        ExpressionAttributeValues={
            ":s": {k: str(v) if v is not None else "" for k, v in settings.items()},
            ":t": datetime.now(timezone.utc).isoformat(),
        },
    )


def put_health_data(
    sub: str,
    key_information: dict,
    patient_context: dict,
    clinical_measurements: dict,
    trend_and_risk: dict,
    recommendations: dict | None = None,
) -> None:
    """Save health data for user. Overwrites existing. Preserves settings. recommendations optional: { actions, diet, exercise, risks }."""
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "sub": sub,
        "keyInformation": key_information,
        "patientContext": patient_context,
        "clinicalMeasurements": clinical_measurements,
        "trendAndRisk": trend_and_risk,
        "updated_at": now,
    }
    if recommendations and isinstance(recommendations, dict):
        item["recommendations"] = {k: str(v) for k, v in recommendations.items() if v is not None}
    # Preserve existing settings when updating health data
    try:
        existing = _get_table().get_item(Key={"sub": sub})
        if existing.get("Item", {}).get("settings"):
            item["settings"] = existing["Item"]["settings"]
    except ClientError:
        pass
    try:
        _get_table().put_item(Item=item)
    except ClientError as e:
        import logging
        logging.getLogger(__name__).warning("DynamoDB put_health_data failed: %s", e)
        raise
