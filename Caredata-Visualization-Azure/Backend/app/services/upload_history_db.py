"""
Store and retrieve CSV upload history per user in Azure Table Storage.
PartitionKey=user_id, RowKey=upload_id. In-memory fallback when Azure not configured.
"""
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
_in_memory_uploads: dict[str, list[dict]] = {}  # sub -> list of upload dicts


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table("uploadhistory")
        except Exception as e:
            if "TableAlreadyExists" not in str(e) and "409" not in str(e):
                raise
        return client.get_table_client("uploadhistory")
    except Exception as e:
        logger.warning("Azure upload_history not available: %s", e)
        return None


def list_uploads(sub: str) -> list[dict]:
    """List all uploads for user, newest first."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter=f"PartitionKey eq '{sub}'"))
            items = []
            for e in entities:
                items.append({
                    "uploadId": e.get("upload_id"),
                    "filename": e.get("filename") or "",
                    "uploadedAt": e.get("uploaded_at"),
                    "analysis": e.get("analysis") or "",
                })
            items.sort(key=lambda x: x.get("uploadedAt") or "", reverse=True)
            return items
        except Exception as e:
            logger.warning("list_uploads: %s", e)
            return []
    out = _in_memory_uploads.get(sub, [])
    out = sorted(out, key=lambda x: x.get("uploadedAt") or "", reverse=True)
    return out


def get_upload(sub: str, upload_id: str) -> dict | None:
    """Get one upload by id."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=sub, row_key=upload_id)
            out = {
                "uploadId": e.get("upload_id"),
                "filename": e.get("filename") or "",
                "uploadedAt": e.get("uploaded_at"),
                "analysis": e.get("analysis") or "",
            }
            if e.get("csv_content") is not None:
                out["csv_content"] = e.get("csv_content")
            return out
        except Exception:
            return None
    for u in _in_memory_uploads.get(sub, []):
        if u.get("uploadId") == upload_id:
            return u
    return None


# Azure Table Storage: max 64KB per property; strings are UTF-16 so max 32K characters per property
MAX_PROPERTY_CHARS = 32 * 1024  # 32768


def put_upload(sub: str, filename: str, analysis: str, csv_content: str | None = None) -> str:
    """Save a new upload. Optionally store csv_content for download (truncated to MAX_PROPERTY_CHARS). Returns upload_id."""
    upload_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    stored_csv = (csv_content or "")[:MAX_PROPERTY_CHARS] if csv_content else None
    analysis_truncated = (analysis or "")[:MAX_PROPERTY_CHARS]
    table = _get_table()
    if table:
        try:
            entity = {
                "PartitionKey": sub,
                "RowKey": upload_id,
                "upload_id": upload_id,
                "filename": filename,
                "uploaded_at": now,
                "analysis": analysis_truncated,
            }
            if stored_csv is not None:
                entity["csv_content"] = stored_csv
            table.upsert_entity(entity)
            return upload_id
        except Exception as e:
            logger.warning("put_upload: %s", e)
            raise
    if sub not in _in_memory_uploads:
        _in_memory_uploads[sub] = []
    rec = {
        "uploadId": upload_id,
        "filename": filename,
        "uploadedAt": now,
        "analysis": analysis_truncated,
    }
    if stored_csv is not None:
        rec["csv_content"] = stored_csv
    _in_memory_uploads[sub].append(rec)
    return upload_id


def delete_upload(sub: str, upload_id: str) -> bool:
    """Delete one upload. Returns True if deleted."""
    table = _get_table()
    if table:
        try:
            table.delete_entity(partition_key=sub, row_key=upload_id)
            return True
        except Exception:
            return False
    lst = _in_memory_uploads.get(sub, [])
    _in_memory_uploads[sub] = [u for u in lst if u.get("uploadId") != upload_id]
    return True


def clear_all_uploads(sub: str) -> int:
    """Delete all uploads for user. Returns count deleted."""
    items = list_uploads(sub)
    count = 0
    for u in items:
        uid = u.get("uploadId")
        if uid and delete_upload(sub, uid):
            count += 1
    return count
