"""
Store and retrieve GPMS (Government Provider Management System) form data per assessment date.
PartitionKey = user_sub, RowKey = assessment_date.
In-memory fallback when Azure not configured.
"""
import json
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "gpmssubmissions"

_in_memory: dict[str, dict[str, dict]] = {}  # user_sub -> {date -> gpms_entity}


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table(TABLE_NAME)
        except Exception as e:
            if "TableAlreadyExists" not in str(e) and "409" not in str(e):
                raise
        return client.get_table_client(TABLE_NAME)
    except Exception as e:
        logger.warning("Azure %s not available: %s", TABLE_NAME, e)
        return None


def put_gpms(
    sub: str,
    assessment_date: str,
    form_data: dict,
    source: str = "manual_entry",
    upload_id: str | None = None,
    submitted: bool = False,
) -> None:
    """Upsert GPMS form data for a specific date."""
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "PartitionKey": sub,
        "RowKey": assessment_date,
        "assessment_date": assessment_date,
        "form_data_json": json.dumps(form_data, default=str),
        "source": source,
        "upload_id": upload_id or "",
        "updated_at": now,
        "submitted": submitted,
    }

    table = _get_table()
    if table:
        try:
            table.upsert_entity(entity)
            logger.info("put_gpms: stored for %s date=%s source=%s", sub[:8], assessment_date, source)
            return
        except Exception as e:
            logger.warning("put_gpms Azure error: %s", e)
            raise

    # In-memory fallback
    if sub not in _in_memory:
        _in_memory[sub] = {}
    _in_memory[sub][assessment_date] = entity
    logger.info("put_gpms (in-memory): stored for date=%s", assessment_date)


def get_gpms(sub: str, assessment_date: str) -> dict | None:
    """Get full GPMS form data for a specific date."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=sub, row_key=assessment_date)
            return _entity_to_dict(e, include_form=True)
        except Exception:
            return None

    e = _in_memory.get(sub, {}).get(assessment_date)
    return _entity_to_dict(e, include_form=True) if e else None


def list_gpms(sub: str) -> list[dict]:
    """List all GPMS dates for a user (light — no form data)."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter=f"PartitionKey eq '{sub}'"))
            items = [_entity_to_dict(e, include_form=False) for e in entities]
            items.sort(key=lambda x: x.get("date", ""))
            return items
        except Exception as e:
            logger.warning("list_gpms: %s", e)
            return []

    items = [_entity_to_dict(e, include_form=False) for e in _in_memory.get(sub, {}).values()]
    items.sort(key=lambda x: x.get("date", ""))
    return items


def delete_gpms(sub: str, assessment_date: str) -> bool:
    """Delete GPMS entry for a specific date."""
    table = _get_table()
    if table:
        try:
            table.delete_entity(partition_key=sub, row_key=assessment_date)
            return True
        except Exception:
            return False

    dates = _in_memory.get(sub, {})
    if assessment_date in dates:
        del dates[assessment_date]
        return True
    return False


def _entity_to_dict(e: dict, include_form: bool = False) -> dict:
    """Convert entity to response dict."""
    out = {
        "date": e.get("assessment_date") or e.get("RowKey", ""),
        "source": e.get("source", ""),
        "uploadId": e.get("upload_id", ""),
        "updatedAt": e.get("updated_at", ""),
        "submitted": bool(e.get("submitted", False)),
    }
    if include_form:
        try:
            out["formData"] = json.loads(e.get("form_data_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            out["formData"] = {}
    return out
