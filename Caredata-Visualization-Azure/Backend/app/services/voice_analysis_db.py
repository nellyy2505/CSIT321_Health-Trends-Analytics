"""
Store and retrieve voice analysis results in Azure Table Storage.
PartitionKey=profile_id, RowKey=analysis_id. In-memory fallback when Azure not configured.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
TABLE_NAME = "voiceanalysis"
_in_memory: dict[str, dict[str, dict]] = {}  # profile_id -> {analysis_id -> analysis}


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
    acoustic = e.get("acoustic_features_json")
    risk = e.get("risk_scores_json")
    return {
        "analysis_id": e.get("analysis_id") or e.get("RowKey"),
        "profile_id": e.get("profile_id") or e.get("PartitionKey"),
        "recording_id": e.get("recording_id"),
        "acoustic_features": json.loads(acoustic) if acoustic else {},
        "risk_scores": json.loads(risk) if risk else {},
        "narrative_report": e.get("narrative_report", ""),
        "alert_level": e.get("alert_level", "green"),
        "confidence": e.get("confidence", "low"),
        "facility_id": e.get("facility_id"),
        "resident_id": e.get("resident_id"),
        "display_name": e.get("display_name"),
        "transcript": e.get("transcript", ""),
        "acknowledged": e.get("acknowledged", False),
        "acknowledged_by": e.get("acknowledged_by"),
        "acknowledged_at": e.get("acknowledged_at"),
        "created_at": e.get("created_at"),
    }


def create_analysis(
    recording_id: str,
    profile_id: str,
    acoustic_features: dict,
    risk_scores: dict,
    narrative_report: str,
    alert_level: str,
    confidence: str = "low",
    facility_id: str | None = None,
    resident_id: str | None = None,
    display_name: str | None = None,
    transcript: str | None = None,
) -> dict:
    """Store a new analysis result. Returns analysis dict."""
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "analysis_id": analysis_id,
        "profile_id": profile_id,
        "recording_id": recording_id,
        "acoustic_features_json": json.dumps(acoustic_features, default=str),
        "risk_scores_json": json.dumps(risk_scores, default=str),
        "narrative_report": narrative_report,
        "alert_level": alert_level,
        "confidence": confidence,
        "facility_id": facility_id or "",
        "resident_id": resident_id or "",
        "display_name": display_name or "",
        "transcript": transcript or "",
        "acknowledged": False,
        "acknowledged_by": None,
        "acknowledged_at": None,
        "created_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": profile_id,
                "RowKey": analysis_id,
                **entity,
            })
        except Exception as e:
            logger.warning("create_analysis: %s", e)
            raise
    else:
        if profile_id not in _in_memory:
            _in_memory[profile_id] = {}
        _in_memory[profile_id][analysis_id] = entity

    return _entity_to_dict(entity)


def get_latest(profile_id: str) -> dict | None:
    """Get the most recent analysis for a profile."""
    analyses = list_analyses(profile_id)
    return analyses[0] if analyses else None


def list_analyses(profile_id: str) -> list[dict]:
    """List all analyses for a profile, newest first."""
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
            logger.warning("list_analyses: %s", e)
            return []
    items = [_entity_to_dict(v) for v in _in_memory.get(profile_id, {}).values()]
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


def get_by_recording(recording_id: str) -> dict | None:
    """Find analysis by recording_id (searches all profiles)."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"recording_id eq '{recording_id}'"
            ))
            if entities:
                return _entity_to_dict(entities[0])
            return None
        except Exception as e:
            logger.warning("get_by_recording: %s", e)
            return None
    for profile_analyses in _in_memory.values():
        for a in profile_analyses.values():
            if a.get("recording_id") == recording_id:
                return _entity_to_dict(a)
    return None


def list_alerts(facility_id: str | None = None, acknowledged: bool = False) -> list[dict]:
    """List alerts (amber/red), optionally filtered by facility and acknowledgement status."""
    table = _get_table()
    all_analyses = []
    if table:
        try:
            filt = "alert_level ne 'green'"
            if facility_id:
                filt += f" and facility_id eq '{facility_id}'"
            entities = list(table.query_entities(query_filter=filt))
            all_analyses = [_entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("list_alerts: %s", e)
            return []
    else:
        for profile_analyses in _in_memory.values():
            for a in profile_analyses.values():
                d = _entity_to_dict(a)
                if d["alert_level"] in ("amber", "red", "urgent"):
                    if facility_id and d.get("facility_id") != facility_id:
                        continue
                    all_analyses.append(d)

    if not acknowledged:
        all_analyses = [a for a in all_analyses if not a.get("acknowledged")]
    all_analyses.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return all_analyses


def acknowledge_alert(profile_id: str, analysis_id: str, acknowledged_by: str) -> bool:
    """Mark an alert as acknowledged."""
    now = datetime.now(timezone.utc).isoformat()
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=analysis_id)
            e["acknowledged"] = True
            e["acknowledged_by"] = acknowledged_by
            e["acknowledged_at"] = now
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    a = _in_memory.get(profile_id, {}).get(analysis_id)
    if a:
        a["acknowledged"] = True
        a["acknowledged_by"] = acknowledged_by
        a["acknowledged_at"] = now
        return True
    return False
