"""
Store and retrieve My Data (health scan text) per user in Azure Table Storage.
Keyed by user id (sub). Falls back to in-memory when Azure is not configured.
"""
import json
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory fallback for dev when Azure is not configured
_in_memory_health: dict[str, dict] = {}  # sub -> data dict


def _get_table_client():
    """Return Azure Table Storage table client if configured, else None."""
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        return client.get_table_client(table_name="healthdata")
    except Exception as e:
        logger.warning("Azure Table Storage health_data not available: %s", e)
        return None


def _ensure_health_table():
    """Create Azure table if it does not exist."""
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table("healthdata")
        except Exception as create_err:
            if "TableAlreadyExists" not in str(create_err) and "409" not in str(create_err):
                raise create_err
        return client.get_table_client("healthdata")
    except Exception as e:
        logger.warning("Azure health_data ensure_table: %s", e)
        return None


def get_health_data(sub: str) -> dict | None:
    """Get stored health data for user. Returns None if not found."""
    if not sub:
        return None
    table = _get_table_client()
    if table:
        try:
            entity = table.get_entity(partition_key="user", row_key=sub)
            data = {}
            for key in ("keyInformation", "patientContext", "clinicalMeasurements", "trendAndRisk", "recommendations"):
                raw = entity.get(key)
                if raw is None:
                    data[key] = {} if key != "recommendations" else None
                elif isinstance(raw, str):
                    try:
                        data[key] = json.loads(raw)
                    except json.JSONDecodeError:
                        data[key] = raw if key == "recommendations" else {}
                else:
                    data[key] = raw
            return data
        except Exception as e:
            if "ResourceNotFound" in str(type(e).__name__) or "404" in str(e):
                return None
            logger.warning("get_health_data: %s", e)
            return None
    return _in_memory_health.get(sub)


def get_settings(sub: str) -> dict:
    """Get user/facility settings. Returns empty dict if none stored."""
    if not sub:
        return {}
    table = _get_table_client()
    if table:
        try:
            entity = table.get_entity(partition_key="user", row_key=sub)
            raw = entity.get("settings")
            if isinstance(raw, str):
                return json.loads(raw) or {}
            return raw if isinstance(raw, dict) else {}
        except Exception:
            return {}
    data = _in_memory_health.get(sub)
    return (data.get("settings") or {}) if isinstance(data, dict) else {}


def put_settings(sub: str, settings: dict) -> None:
    """Save user/facility settings. Creates or updates entity."""
    if not sub:
        return
    table = _ensure_health_table() or _get_table_client()
    if table:
        try:
            entity = {"PartitionKey": "user", "RowKey": sub, "settings": json.dumps(settings or {})}
            try:
                existing = table.get_entity(partition_key="user", row_key=sub)
                for k, v in existing.items():
                    if k not in ("PartitionKey", "RowKey", "settings") and v is not None:
                        entity[k] = v
            except Exception:
                pass
            table.upsert_entity(entity)
        except Exception as e:
            logger.warning("put_settings: %s", e)
            raise
    else:
        if sub not in _in_memory_health:
            _in_memory_health[sub] = {}
        _in_memory_health[sub]["settings"] = settings or {}


def put_health_data(
    sub: str,
    key_information: dict,
    patient_context: dict,
    clinical_measurements: dict,
    trend_and_risk: dict,
    recommendations: dict | None = None,
) -> None:
    """Save health data for user. Overwrites existing. Preserves settings."""
    if not sub:
        return
    now = datetime.now(timezone.utc).isoformat()
    table = _ensure_health_table() or _get_table_client()
    entity = {
        "PartitionKey": "user",
        "RowKey": sub,
        "keyInformation": json.dumps(key_information or {}),
        "patientContext": json.dumps(patient_context or {}),
        "clinicalMeasurements": json.dumps(clinical_measurements or {}),
        "trendAndRisk": json.dumps(trend_and_risk or {}),
        "recommendations": json.dumps(recommendations or {}),
        "updated_at": now,
    }
    if table:
        try:
            try:
                existing = table.get_entity(partition_key="user", row_key=sub)
                if existing.get("settings") is not None:
                    entity["settings"] = existing["settings"]
            except Exception:
                pass
            table.upsert_entity(entity)
        except Exception as e:
            logger.warning("put_health_data failed: %s", e)
            raise
    else:
        _in_memory_health[sub] = {
            "keyInformation": key_information or {},
            "patientContext": patient_context or {},
            "clinicalMeasurements": clinical_measurements or {},
            "trendAndRisk": trend_and_risk or {},
            "recommendations": recommendations or {},
            "updated_at": now,
        }
