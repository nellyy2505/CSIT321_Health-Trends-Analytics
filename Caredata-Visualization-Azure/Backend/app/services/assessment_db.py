"""
Store and retrieve resident-level QI assessment data in Azure Table Storage.
PartitionKey = {user_sub}_{assessment_date}, RowKey = resident_id.
In-memory fallback when Azure not configured.
"""
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "assessments"

# All clinical columns stored per resident per assessment date
CLINICAL_COLUMNS = [
    "PI_01", "PI_S1", "PI_S2", "PI_S3", "PI_S4", "PI_US", "PI_DTI",
    "RP_01", "RP_MECH", "RP_PHYS", "RP_ENV", "RP_SEC",
    "UWL_SIG", "UWL_CON",
    "FALL_01", "FALL_MAJ",
    "MED_POLY", "MED_AP",
    "ADL_01", "ADL_BOWEL", "ADL_BLADDER", "ADL_GROOM", "ADL_TOILET",
    "ADL_FEED", "ADL_TRANS", "ADL_MOB", "ADL_DRESS", "ADL_STAIRS", "ADL_BATH",
    "IC_IAD", "IC_IAD_1A", "IC_IAD_1B", "IC_IAD_2A", "IC_IAD_2B",
    "HOSP_ED", "HOSP_ALL",
    "CE_01", "QOL_01",
    "AH_MIN", "AH_REC_RECOMMENDED", "AH_REC_RECEIVED",
    "AH_RCVD_PHYSIO", "AH_RCVD_OT", "AH_RCVD_SPEECH",
    "AH_RCVD_POD", "AH_RCVD_DIET", "AH_RCVD_OTHER", "AH_RCVD_ASSIST",
    "WF_HOURS_PPD", "WF_ADEQUATE",
    "EN_DIRECT_PCT",
    "LS_SESSIONS_QTR",
]

FLOAT_COLUMNS = {"WF_HOURS_PPD", "EN_DIRECT_PCT"}

_in_memory: dict[str, dict[str, dict]] = {}  # partition_key -> {resident_id -> row}


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


def _make_partition_key(sub: str, assessment_date: str) -> str:
    return f"{sub}_{assessment_date}"


def _parse_value(col: str, raw):
    """Parse a raw CSV value into int or float for storage."""
    if raw is None or raw == "":
        return None
    try:
        if col in FLOAT_COLUMNS:
            return float(raw)
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def put_assessments(sub: str, assessment_date: str, rows: list[dict], upload_id: str) -> int:
    """Batch upsert resident assessment rows for a single date. Returns count stored."""
    pk = _make_partition_key(sub, assessment_date)
    now = datetime.now(timezone.utc).isoformat()
    table = _get_table()

    entities = []
    for row in rows:
        resident_id = row.get("Resident_ID") or row.get("resident_id") or ""
        if not resident_id:
            continue
        entity = {
            "PartitionKey": pk,
            "RowKey": resident_id,
            "user_sub": sub,
            "assessment_date": assessment_date,
            "resident_id": resident_id,
            "upload_id": upload_id,
            "stored_at": now,
        }
        for col in CLINICAL_COLUMNS:
            val = _parse_value(col, row.get(col))
            if val is not None:
                entity[col] = val
        entities.append(entity)

    if table:
        try:
            # Azure batch operations: max 100 per batch, same partition
            from azure.data.tables import TransactionOperation
            batch_size = 100
            for i in range(0, len(entities), batch_size):
                batch = entities[i:i + batch_size]
                operations = [(TransactionOperation.UPSERT, e) for e in batch]
                table.submit_transaction(operations)
            logger.info("put_assessments: stored %d rows for %s date=%s", len(entities), sub[:8], assessment_date)
            return len(entities)
        except Exception as e:
            logger.warning("put_assessments Azure error: %s", e)
            raise

    # In-memory fallback
    if pk not in _in_memory:
        _in_memory[pk] = {}
    for e in entities:
        _in_memory[pk][e["RowKey"]] = e
    logger.info("put_assessments (in-memory): stored %d rows for date=%s", len(entities), assessment_date)
    return len(entities)


def get_assessments_by_date(sub: str, assessment_date: str) -> list[dict]:
    """Get all resident assessments for a specific date."""
    pk = _make_partition_key(sub, assessment_date)
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter=f"PartitionKey eq '{pk}'"))
            return [_entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("get_assessments_by_date: %s", e)
            return []
    return [_entity_to_dict(e) for e in _in_memory.get(pk, {}).values()]


def get_resident_history(sub: str, resident_id: str, dates: list[str]) -> list[dict]:
    """Get a single resident's data across multiple dates via point reads."""
    results = []
    table = _get_table()
    for d in dates:
        pk = _make_partition_key(sub, d)
        if table:
            try:
                e = table.get_entity(partition_key=pk, row_key=resident_id)
                results.append(_entity_to_dict(e))
            except Exception:
                pass  # resident not present for this date
        else:
            e = _in_memory.get(pk, {}).get(resident_id)
            if e:
                results.append(_entity_to_dict(e))
    results.sort(key=lambda x: x.get("assessment_date", ""))
    return results


def delete_assessments_by_date(sub: str, assessment_date: str) -> int:
    """Delete all resident assessments for a specific date."""
    pk = _make_partition_key(sub, assessment_date)
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"PartitionKey eq '{pk}'",
                select=["PartitionKey", "RowKey"],
            ))
            from azure.data.tables import TransactionOperation
            batch_size = 100
            count = 0
            for i in range(0, len(entities), batch_size):
                batch = entities[i:i + batch_size]
                operations = [(TransactionOperation.DELETE, e) for e in batch]
                table.submit_transaction(operations)
                count += len(batch)
            return count
        except Exception as e:
            logger.warning("delete_assessments_by_date: %s", e)
            return 0
    removed = len(_in_memory.pop(pk, {}))
    return removed


def _entity_to_dict(e: dict) -> dict:
    """Convert Azure entity or in-memory dict to a clean response dict."""
    out = {
        "resident_id": e.get("resident_id") or e.get("RowKey", ""),
        "assessment_date": e.get("assessment_date", ""),
    }
    for col in CLINICAL_COLUMNS:
        if col in e and e[col] is not None:
            out[col] = e[col]
    return out
