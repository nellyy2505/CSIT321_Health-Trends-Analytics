"""
GPMS (Government Provider Management System) API: save and retrieve GPMS form data.
All endpoints require JWT authentication.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.services.jwt_auth import get_current_user
from app.services import gpms_db

router = APIRouter(prefix="/api/gpms", tags=["GPMS"])
logger = logging.getLogger(__name__)


class GPMSSaveRequest(BaseModel):
    formData: dict
    submitted: bool = False


@router.get("")
def list_gpms_submissions(current_user: dict = Depends(get_current_user)):
    """List all GPMS dates for the current user (light — no form data)."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    submissions = gpms_db.list_gpms(sub)
    return {"submissions": submissions}


@router.get("/{date}")
def get_gpms_submission(date: str, current_user: dict = Depends(get_current_user)):
    """Get full GPMS form data for a specific date."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    gpms = gpms_db.get_gpms(sub, date)
    if not gpms:
        raise HTTPException(status_code=404, detail=f"No GPMS data for date {date}")
    return gpms


@router.put("/{date}")
def save_gpms_submission(
    date: str,
    body: GPMSSaveRequest,
    current_user: dict = Depends(get_current_user),
):
    """Save or update GPMS form data for a specific date."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    gpms_db.put_gpms(
        sub=sub,
        assessment_date=date,
        form_data=body.formData,
        source="manual_entry",
        submitted=body.submitted,
    )
    return {"ok": True, "date": date}


@router.delete("/{date}")
def delete_gpms_submission(date: str, current_user: dict = Depends(get_current_user)):
    """Delete GPMS submission for a specific date."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    deleted = gpms_db.delete_gpms(sub, date)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No GPMS data for date {date}")
    return {"ok": True, "date": date}
