"""
QI Data API: query pre-computed aggregates and resident-level assessment data.
All endpoints require JWT authentication.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.jwt_auth import get_current_user
from app.services import qi_aggregate_db, assessment_db

router = APIRouter(prefix="/api/qi", tags=["QI Data"])
logger = logging.getLogger(__name__)


@router.get("/aggregates")
def list_aggregates(current_user: dict = Depends(get_current_user)):
    """Return all QI aggregates for the current user, sorted by date. Used by Dashboard & Reports."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    aggregates = qi_aggregate_db.list_aggregates(sub)
    dates = [a["assessmentDate"] for a in aggregates]
    quarter_labels = [a["quarterLabel"] for a in aggregates]

    return {
        "dates": dates,
        "quarterLabels": quarter_labels,
        "aggregates": aggregates,
    }


@router.get("/aggregates/{date}")
def get_aggregate(date: str, current_user: dict = Depends(get_current_user)):
    """Return QI aggregate for a single date."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    agg = qi_aggregate_db.get_aggregate(sub, date)
    if not agg:
        raise HTTPException(status_code=404, detail=f"No aggregate data for date {date}")
    return agg


@router.get("/residents")
def list_residents(
    date: str = Query(..., description="Assessment date (ISO YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user),
):
    """Return resident-level assessment data for a specific date."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    residents = assessment_db.get_assessments_by_date(sub, date)
    return {
        "date": date,
        "totalResidents": len(residents),
        "residents": residents,
    }


@router.get("/residents/{resident_id}")
def get_resident_history(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a single resident's assessment history across all dates."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get all available dates from aggregates
    aggregates = qi_aggregate_db.list_aggregates(sub)
    dates = [a["assessmentDate"] for a in aggregates]

    if not dates:
        return {"residentId": resident_id, "assessments": []}

    assessments = assessment_db.get_resident_history(sub, resident_id, dates)
    return {
        "residentId": resident_id,
        "assessments": assessments,
    }
