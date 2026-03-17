"""
Care Journey API: list patients with care journey data from CSV uploads.
For aged care managers. Data is populated when user uploads a facility CSV.
Supports updating journey data (name, risk, timeline) per patient.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.services.cognito_auth import get_current_user_cognito
from app.services import care_journey_db

router = APIRouter(prefix="/care-journey", tags=["Care Journey"])
logger = logging.getLogger(__name__)


class UpdateJourneyBody(BaseModel):
    name: str | None = None
    risk: str | None = None
    timeline: dict | None = None


@router.get("/patients")
def list_care_journey_patients(
    current_user: dict = Depends(get_current_user_cognito),
    upload_id: str | None = Query(None, description="Filter by upload ID; if omitted, returns all"),
):
    """List all patients/residents with care journey data. Optionally filter by upload."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    patients = care_journey_db.list_journeys(sub, upload_id)
    logger.info("[care_journey] list_journeys returned %d patients", len(patients))
    return {"patients": patients}


@router.put("/patients/{upload_id}/{resident_id}")
def update_care_journey(
    upload_id: str,
    resident_id: str,
    body: UpdateJourneyBody,
    current_user: dict = Depends(get_current_user_cognito),
):
    """Update a patient's care journey (name, risk, timeline)."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    updated = care_journey_db.update_journey(
        sub=sub,
        upload_id=upload_id,
        resident_id=resident_id,
        name=body.name,
        risk=body.risk,
        timeline=body.timeline,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"ok": True, "patient": updated}
