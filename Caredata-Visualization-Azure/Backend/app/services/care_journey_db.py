"""
Store and retrieve care journey data (patient/resident timelines) in Azure Table Storage.
PartitionKey=user_id, RowKey=upload_id__resident_id (no # allowed in Azure keys). In-memory fallback when Azure not configured.
"""
import json
import logging
import os

from app.core.config import settings

logger = logging.getLogger(__name__)
_in_memory_journeys: dict[str, list[dict]] = {}  # sub -> list of journey dicts


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table("carejourney")
        except Exception as e:
            if "TableAlreadyExists" not in str(e) and "409" not in str(e):
                raise
        return client.get_table_client("carejourney")
    except Exception as e:
        logger.warning("Azure care_journey not available: %s", e)
        return None


def _sk(upload_id: str, resident_id: str) -> str:
    # Azure Table Storage disallows # in PartitionKey/RowKey; use __
    return f"{upload_id}__{resident_id}"


def put_journey(sub: str, upload_id: str, resident_id: str, resident_name: str, risk: str, timeline: dict) -> None:
    """Save one resident's care journey. Overwrites if exists."""
    table = _get_table()
    row_key = _sk(upload_id, resident_id)
    timeline_str = json.dumps(timeline) if isinstance(timeline, dict) else str(timeline)
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": sub,
                "RowKey": row_key,
                "upload_id": upload_id,
                "resident_id": resident_id,
                "resident_name": (resident_name or resident_id)[:200],
                "risk": (risk or "Low")[:50],
                "timeline": timeline_str,
            })
        except Exception as e:
            logger.warning("put_journey: %s", e)
            raise
    else:
        if sub not in _in_memory_journeys:
            _in_memory_journeys[sub] = []
        lst = [j for j in _in_memory_journeys[sub] if not (j.get("uploadId") == upload_id and j.get("id") == resident_id)]
        lst.append({
            "id": resident_id,
            "name": resident_name or resident_id,
            "risk": risk or "Low",
            "uploadId": upload_id,
            "timeline": timeline,
        })
        _in_memory_journeys[sub] = lst


def list_journeys(sub: str, upload_id: str | None = None) -> list[dict]:
    """List all care journeys for user. Optionally filter by upload_id."""
    table = _get_table()
    if table:
        try:
            if upload_id:
                prefix = f"{upload_id}__"
                entities = [e for e in table.query_entities(query_filter=f"PartitionKey eq '{sub}'")
                           if (e.get("RowKey") or "").startswith(prefix)]
            else:
                entities = list(table.query_entities(query_filter=f"PartitionKey eq '{sub}'"))
            result = []
            for e in entities:
                tl = e.get("timeline")
                if isinstance(tl, str):
                    try:
                        tl = json.loads(tl)
                    except json.JSONDecodeError:
                        tl = {}
                result.append({
                    "id": e.get("resident_id"),
                    "name": e.get("resident_name") or "",
                    "risk": e.get("risk") or "Low",
                    "uploadId": e.get("upload_id"),
                    "timeline": tl or {},
                })
            return result
        except Exception as e:
            logger.warning("list_journeys: %s", e)
            return []
    lst = _in_memory_journeys.get(sub, [])
    if upload_id:
        lst = [j for j in lst if j.get("uploadId") == upload_id]
    return lst


def get_journey(sub: str, upload_id: str, resident_id: str) -> dict | None:
    """Get a single care journey by sub, upload_id, resident_id."""
    table = _get_table()
    row_key = _sk(upload_id, resident_id)
    if table:
        try:
            e = table.get_entity(partition_key=sub, row_key=row_key)
            tl = e.get("timeline")
            if isinstance(tl, str):
                try:
                    tl = json.loads(tl)
                except json.JSONDecodeError:
                    tl = {}
            return {
                "id": e.get("resident_id"),
                "name": e.get("resident_name") or "",
                "risk": e.get("risk") or "Low",
                "uploadId": e.get("upload_id"),
                "timeline": tl or {},
            }
        except Exception:
            return None
    for j in _in_memory_journeys.get(sub, []):
        if j.get("uploadId") == upload_id and j.get("id") == resident_id:
            return j
    return None


def update_journey(
    sub: str,
    upload_id: str,
    resident_id: str,
    name: str | None = None,
    risk: str | None = None,
    timeline: dict | None = None,
) -> dict | None:
    """Update a care journey. Merges with existing. Returns updated item or None if not found."""
    existing = get_journey(sub, upload_id, resident_id)
    if not existing:
        return None
    resident_name = (name or existing.get("name") or resident_id)[:200]
    risk_val = (risk if risk is not None else existing.get("risk") or "Low")[:50]
    tl = timeline if timeline is not None else (existing.get("timeline") or {})
    put_journey(sub, upload_id, resident_id, resident_name, risk_val, tl)
    return {
        "id": resident_id,
        "name": resident_name,
        "risk": risk_val,
        "uploadId": upload_id,
        "timeline": tl,
    }


def delete_journeys_by_upload(sub: str, upload_id: str) -> int:
    """Delete all journey records for an upload. Returns count deleted."""
    items = list_journeys(sub, upload_id)
    count = 0
    for j in items:
        rid = j.get("id")
        if rid:
            table = _get_table()
            if table:
                try:
                    table.delete_entity(partition_key=sub, row_key=_sk(upload_id, rid))
                    count += 1
                except Exception:
                    pass
            else:
                _in_memory_journeys[sub] = [x for x in _in_memory_journeys.get(sub, [])
                                            if not (x.get("uploadId") == upload_id and x.get("id") == rid)]
                count += 1
    return count
