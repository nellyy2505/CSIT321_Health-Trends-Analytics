"""
Store and retrieve CSV upload history per user in DynamoDB.
PK: sub, SK: upload_id (uuid).
"""
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("UPLOAD_HISTORY_TABLE_NAME", "CareDataUploadHistory-dev")
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


def list_uploads(sub: str) -> list[dict]:
    """List all uploads for user, newest first."""
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
                "uploadId": _to_json_friendly(i.get("upload_id")),
                "filename": _to_json_friendly(i.get("filename")),
                "uploadedAt": _to_json_friendly(i.get("uploaded_at")),
                "analysis": _to_json_friendly(i.get("analysis")),
            }
            for i in items
        ]
    except ClientError as e:
        logger.warning("[upload_history_db.list_uploads] DynamoDB ClientError: %s (sub=%s)", e, sub[:20] if sub else "?")
        return []


def get_upload(sub: str, upload_id: str) -> dict | None:
    """Get one upload by id."""
    try:
        r = _get_table().get_item(
            Key={"sub": sub, "upload_id": upload_id}
        )
        item = r.get("Item")
        if not item:
            return None
        return {
            "uploadId": _to_json_friendly(item.get("upload_id")),
            "filename": _to_json_friendly(item.get("filename")),
            "uploadedAt": _to_json_friendly(item.get("uploaded_at")),
            "analysis": _to_json_friendly(item.get("analysis")),
        }
    except ClientError:
        return None


def put_upload(sub: str, filename: str, analysis: str) -> str:
    """Save a new upload. Returns upload_id."""
    upload_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    try:
        _get_table().put_item(
            Item={
                "sub": sub,
                "upload_id": upload_id,
                "filename": filename,
                "uploaded_at": now,
                "analysis": analysis[:50000] if analysis else "",  # limit size
            }
        )
        return upload_id
    except ClientError as e:
        import logging
        logging.getLogger(__name__).warning("DynamoDB put_upload failed: %s", e)
        raise


def delete_upload(sub: str, upload_id: str) -> bool:
    """Delete one upload. Returns True if deleted."""
    try:
        _get_table().delete_item(
            Key={"sub": sub, "upload_id": upload_id}
        )
        return True
    except ClientError:
        return False


def clear_all_uploads(sub: str) -> int:
    """Delete all uploads for user. Returns count deleted."""
    items = list_uploads(sub)
    # list_uploads returns list of dicts with uploadId
    count = 0
    for u in items:
        uid = u.get("uploadId")
        if uid and delete_upload(sub, uid):
            count += 1
    return count
