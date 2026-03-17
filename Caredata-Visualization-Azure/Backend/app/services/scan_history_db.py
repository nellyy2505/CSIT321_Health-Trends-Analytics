"""
Store and retrieve Health Scan history per user in Azure Table Storage.
PartitionKey=user_id, RowKey=scan_id. In-memory fallback when Azure not configured.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
_in_memory_scans: dict[str, list[dict]] = {}  # sub -> list of scan dicts


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table("scanhistory")
        except Exception as e:
            if "TableAlreadyExists" not in str(e) and "409" not in str(e):
                raise
        return client.get_table_client("scanhistory")
    except Exception as e:
        logger.warning("Azure scan_history not available: %s", e)
        return None


def list_scans(sub: str) -> list[dict]:
    """List all scans for user, newest first."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter=f"PartitionKey eq '{sub}'"))
            items = []
            for e in entities:
                items.append({
                    "scanId": e.get("scan_id"),
                    "scannedAt": e.get("scanned_at"),
                    "imageCount": e.get("image_count"),
                    "summary": e.get("summary") or "",
                })
            items.sort(key=lambda x: x.get("scannedAt") or "", reverse=True)
            return items
        except Exception as e:
            logger.warning("list_scans: %s", e)
            return []
    out = _in_memory_scans.get(sub, [])
    out = sorted(out, key=lambda x: x.get("scannedAt") or "", reverse=True)
    return out


def put_scan(sub: str, image_count: int, summary: str = "") -> str:
    """Record a new scan. Returns scan_id."""
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": sub,
                "RowKey": scan_id,
                "scan_id": scan_id,
                "scanned_at": now,
                "image_count": image_count,
                "summary": (summary or "")[:500],
            })
            return scan_id
        except Exception as e:
            logger.warning("put_scan: %s", e)
            raise
    if sub not in _in_memory_scans:
        _in_memory_scans[sub] = []
    _in_memory_scans[sub].append({
        "scanId": scan_id,
        "scannedAt": now,
        "imageCount": image_count,
        "summary": (summary or "")[:500],
    })
    return scan_id


def delete_scan(sub: str, scan_id: str) -> bool:
    """Delete one scan. Returns True if deleted."""
    table = _get_table()
    if table:
        try:
            table.delete_entity(partition_key=sub, row_key=scan_id)
            return True
        except Exception:
            return False
    lst = _in_memory_scans.get(sub, [])
    _in_memory_scans[sub] = [s for s in lst if s.get("scanId") != scan_id]
    return True


def clear_all_scans(sub: str) -> int:
    """Delete all scans for user. Returns count deleted."""
    items = list_scans(sub)
    count = 0
    for s in items:
        sid = s.get("scanId")
        if sid and delete_scan(sub, sid):
            count += 1
    return count
