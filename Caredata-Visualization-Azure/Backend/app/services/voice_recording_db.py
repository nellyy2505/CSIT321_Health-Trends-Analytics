"""
Store and retrieve voice recordings in Azure Table Storage.
PartitionKey=profile_id, RowKey=recording_id. In-memory fallback when Azure not configured.
"""
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
TABLE_NAME = "voicerecordings"
_in_memory: dict[str, dict[str, dict]] = {}  # profile_id -> {recording_id -> recording}

# In-memory audio storage (dev fallback when no filesystem persistence needed)
_in_memory_audio: dict[str, bytes] = {}  # recording_id -> audio bytes


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


def _entity_to_dict(e: dict) -> dict:
    return {
        "recording_id": e.get("recording_id") or e.get("RowKey"),
        "profile_id": e.get("profile_id") or e.get("PartitionKey"),
        "duration_s": e.get("duration_s", 0),
        "prompt_id": e.get("prompt_id"),
        "audio_file_path": e.get("audio_file_path"),
        "status": e.get("status", "uploaded"),
        "created_at": e.get("created_at"),
    }


def create_recording(
    profile_id: str,
    duration_s: float,
    prompt_id: str,
    audio_file_path: str,
) -> dict:
    """Create a new recording entry. Returns recording dict."""
    recording_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "recording_id": recording_id,
        "profile_id": profile_id,
        "duration_s": duration_s,
        "prompt_id": prompt_id,
        "audio_file_path": audio_file_path,
        "status": "uploaded",
        "created_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": profile_id,
                "RowKey": recording_id,
                **entity,
            })
            return entity
        except Exception as e:
            logger.warning("create_recording: %s", e)
            raise
    if profile_id not in _in_memory:
        _in_memory[profile_id] = {}
    _in_memory[profile_id][recording_id] = entity
    return entity


def get_recording(profile_id: str, recording_id: str) -> dict | None:
    """Retrieve a single recording."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=recording_id)
            return _entity_to_dict(e)
        except Exception:
            return None
    return _in_memory.get(profile_id, {}).get(recording_id)


def list_recordings(profile_id: str) -> list[dict]:
    """List all recordings for a profile, newest first."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"PartitionKey eq '{profile_id}'"
            ))
            items = [_entity_to_dict(e) for e in entities]
            items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
            return items
        except Exception as e:
            logger.warning("list_recordings: %s", e)
            return []
    items = list(_in_memory.get(profile_id, {}).values())
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


def update_status(profile_id: str, recording_id: str, status: str) -> bool:
    """Update recording status (uploaded/processing/analyzed/failed)."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=recording_id)
            e["status"] = status
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    rec = _in_memory.get(profile_id, {}).get(recording_id)
    if rec:
        rec["status"] = status
        return True
    return False


def delete_recording(profile_id: str, recording_id: str) -> bool:
    """Delete a recording entry. Returns True if deleted."""
    table = _get_table()
    if table:
        try:
            table.delete_entity(partition_key=profile_id, row_key=recording_id)
            return True
        except Exception:
            return False
    recs = _in_memory.get(profile_id, {})
    if recording_id in recs:
        del recs[recording_id]
        _in_memory_audio.pop(recording_id, None)
        return True
    return False


def store_audio(recording_id: str, audio_bytes: bytes) -> None:
    """Store audio bytes in memory (dev fallback)."""
    _in_memory_audio[recording_id] = audio_bytes


def get_audio(recording_id: str) -> bytes | None:
    """Retrieve stored audio bytes (dev fallback)."""
    return _in_memory_audio.get(recording_id)
