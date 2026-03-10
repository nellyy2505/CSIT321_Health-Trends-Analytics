"""
Store and retrieve Health Scan history per user in DynamoDB.
PK: sub, SK: scan_id (uuid).
"""
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("SCAN_HISTORY_TABLE_NAME", "CareDataScanHistory-dev")
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


def list_scans(sub: str) -> list[dict]:
    """List all scans for user, newest first."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        r = _get_table().query(
            KeyConditionExpression="#s = :sub",
            ExpressionAttributeNames={"#s": "sub"},
            ExpressionAttributeValues={":sub": sub},
            ScanIndexForward=False,
        )
        items = r.get("Items") or []
        return [
            {
                "scanId": _to_json_friendly(i.get("scan_id")),
                "scannedAt": _to_json_friendly(i.get("scanned_at")),
                "imageCount": _to_json_friendly(i.get("image_count")),
                "summary": _to_json_friendly(i.get("summary")),
            }
            for i in items
        ]
    except ClientError as e:
        logger.warning("[scan_history_db.list_scans] DynamoDB ClientError: %s (sub=%s)", e, sub[:20] if sub else "?")
        return []


def put_scan(sub: str, image_count: int, summary: str = "") -> str:
    """Record a new scan. Returns scan_id."""
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    try:
        _get_table().put_item(
            Item={
                "sub": sub,
                "scan_id": scan_id,
                "scanned_at": now,
                "image_count": image_count,
                "summary": (summary or "")[:500],
            }
        )
        return scan_id
    except ClientError as e:
        import logging
        logging.getLogger(__name__).warning("DynamoDB put_scan failed: %s", e)
        raise


def delete_scan(sub: str, scan_id: str) -> bool:
    """Delete one scan. Returns True if deleted."""
    try:
        _get_table().delete_item(
            Key={"sub": sub, "scan_id": scan_id}
        )
        return True
    except ClientError:
        return False


def clear_all_scans(sub: str) -> int:
    """Delete all scans for user. Returns count deleted."""
    items = list_scans(sub)
    count = 0
    for s in items:
        sid = s.get("scanId")
        if sid and delete_scan(sub, sid):
            count += 1
    return count
