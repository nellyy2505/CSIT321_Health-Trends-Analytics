"""
Store and retrieve pre-computed QI aggregate data per assessment date.
PartitionKey = user_sub, RowKey = assessment_date.
In-memory fallback when Azure not configured.
"""
import json
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "qiaggregates"

_in_memory: dict[str, dict[str, dict]] = {}  # user_sub -> {date -> aggregate}


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


def put_aggregate(
    sub: str,
    assessment_date: str,
    quarter_label: str,
    total_residents: int,
    indicators: list[dict],
    summary_strip: dict,
    residents_at_risk: dict,
    upload_id: str,
    facility_name: str = "",
) -> None:
    """Upsert pre-computed aggregate data for one date."""
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "PartitionKey": sub,
        "RowKey": assessment_date,
        "assessment_date": assessment_date,
        "quarter_label": quarter_label,
        "total_residents": total_residents,
        "upload_id": upload_id,
        "computed_at": now,
        "facility_name": facility_name,
        "indicators_json": json.dumps(indicators, default=str),
        "summary_strip_json": json.dumps(summary_strip, default=str),
        "residents_at_risk_json": json.dumps(residents_at_risk, default=str),
    }

    table = _get_table()
    if table:
        try:
            table.upsert_entity(entity)
            logger.info("put_aggregate: stored for %s date=%s", sub[:8], assessment_date)
            return
        except Exception as e:
            logger.warning("put_aggregate Azure error: %s", e)
            raise

    # In-memory fallback
    if sub not in _in_memory:
        _in_memory[sub] = {}
    _in_memory[sub][assessment_date] = entity
    logger.info("put_aggregate (in-memory): stored for date=%s", assessment_date)


def list_aggregates(sub: str) -> list[dict]:
    """List all aggregate data for a user, sorted by date ascending."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter=f"PartitionKey eq '{sub}'"))
            items = [_entity_to_dict(e) for e in entities]
            items.sort(key=lambda x: x.get("assessmentDate", ""))
            return items
        except Exception as e:
            logger.warning("list_aggregates: %s", e)
            return []

    items = [_entity_to_dict(e) for e in _in_memory.get(sub, {}).values()]
    items.sort(key=lambda x: x.get("assessmentDate", ""))
    return items


def get_aggregate(sub: str, assessment_date: str) -> dict | None:
    """Get aggregate data for a single date."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=sub, row_key=assessment_date)
            return _entity_to_dict(e)
        except Exception:
            return None

    e = _in_memory.get(sub, {}).get(assessment_date)
    return _entity_to_dict(e) if e else None


def delete_aggregate(sub: str, assessment_date: str) -> bool:
    """Delete aggregate for a single date."""
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


def _entity_to_dict(e: dict) -> dict:
    """Convert Azure entity to clean response dict."""
    indicators = []
    summary_strip = {}
    residents_at_risk = {}
    try:
        indicators = json.loads(e.get("indicators_json") or "[]")
    except (json.JSONDecodeError, TypeError):
        pass
    try:
        summary_strip = json.loads(e.get("summary_strip_json") or "{}")
    except (json.JSONDecodeError, TypeError):
        pass
    try:
        residents_at_risk = json.loads(e.get("residents_at_risk_json") or "{}")
    except (json.JSONDecodeError, TypeError):
        pass

    return {
        "assessmentDate": e.get("assessment_date") or e.get("RowKey", ""),
        "quarterLabel": e.get("quarter_label", ""),
        "totalResidents": e.get("total_residents", 0),
        "uploadId": e.get("upload_id", ""),
        "computedAt": e.get("computed_at", ""),
        "facilityName": e.get("facility_name", ""),
        "indicators": indicators,
        "summaryStrip": summary_strip,
        "residentsAtRisk": residents_at_risk,
    }
