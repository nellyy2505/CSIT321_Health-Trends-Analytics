"""
Store and retrieve care journey data (patient/resident timelines) per user.
Data comes from CSV uploads. PK: sub, SK: upload_id#resident_id.
"""
import os
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("CARE_JOURNEY_TABLE_NAME", "CareDataCareJourney-dev")
REGION = os.environ.get("AWS_REGION") or os.environ.get("COGNITO_REGION") or "ap-southeast-2"


def _get_table():
    return boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)


def _to_json_friendly(obj):
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _to_json_friendly(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_friendly(v) for v in obj]
    return obj


def _sk(upload_id: str, resident_id: str) -> str:
    return f"{upload_id}#{resident_id}"


def put_journey(sub: str, upload_id: str, resident_id: str, resident_name: str, risk: str, timeline: dict) -> None:
    """Save one resident's care journey. Overwrites if exists."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        _get_table().put_item(
            Item={
                "sub": sub,
                "sk": _sk(upload_id, resident_id),
                "upload_id": upload_id,
                "resident_id": resident_id,
                "resident_name": (resident_name or resident_id)[:200],
                "risk": (risk or "Low")[:50],
                "timeline": timeline,
            }
        )
    except ClientError as e:
        logger.warning("DynamoDB put_journey failed: %s", e)
        raise


def list_journeys(sub: str, upload_id: str | None = None) -> list[dict]:
    """List all care journeys for user. Optionally filter by upload_id."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        # Query by sub; DynamoDB reserved keyword "sub" -> use ExpressionAttributeNames
        if upload_id:
            r = _get_table().query(
                KeyConditionExpression="#s = :sub AND begins_with(sk, :prefix)",
                ExpressionAttributeNames={"#s": "sub"},
                ExpressionAttributeValues={":sub": sub, ":prefix": f"{upload_id}#"},
            )
        else:
            r = _get_table().query(
                KeyConditionExpression="#s = :sub",
                ExpressionAttributeNames={"#s": "sub"},
                ExpressionAttributeValues={":sub": sub},
            )
        items = r.get("Items") or []
        result = []
        for i in items:
            tl = i.get("timeline") or {}
            result.append({
                "id": _to_json_friendly(i.get("resident_id")),
                "name": _to_json_friendly(i.get("resident_name")),
                "risk": _to_json_friendly(i.get("risk")),
                "uploadId": _to_json_friendly(i.get("upload_id")),
                "timeline": _to_json_friendly(tl),
            })
        return result
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            logger.info("[care_journey_db] Table %s does not exist. Run create-history-tables.ps1 to create it.", TABLE_NAME)
        else:
            logger.warning("[care_journey_db.list_journeys] DynamoDB ClientError: %s", e)
        return []


def get_journey(sub: str, upload_id: str, resident_id: str) -> dict | None:
    """Get a single care journey by sub, upload_id, resident_id."""
    try:
        r = _get_table().get_item(
            Key={"sub": sub, "sk": _sk(upload_id, resident_id)}
        )
        item = r.get("Item")
        if not item:
            return None
        tl = item.get("timeline") or {}
        return {
            "id": _to_json_friendly(item.get("resident_id")),
            "name": _to_json_friendly(item.get("resident_name")),
            "risk": _to_json_friendly(item.get("risk")),
            "uploadId": _to_json_friendly(item.get("upload_id")),
            "timeline": _to_json_friendly(tl),
        }
    except ClientError:
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
    existing = _get_table().get_item(
        Key={"sub": sub, "sk": _sk(upload_id, resident_id)}
    ).get("Item")
    if not existing:
        return None
    resident_name = (name or existing.get("resident_name") or resident_id)[:200]
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
            try:
                _get_table().delete_item(
                    Key={"sub": sub, "sk": _sk(upload_id, rid)}
                )
                count += 1
            except ClientError:
                pass
    return count
