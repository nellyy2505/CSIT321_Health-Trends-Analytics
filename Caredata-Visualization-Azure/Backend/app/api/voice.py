"""
Voice Biomarker Screening API — Phase 1 MVP.

Endpoints for:
- Recording link generation (nurse auth)
- Resident authentication (link-token-based)
- Audio recording upload and retrieval (resident auth)
- Analysis results and alerts (nurse auth)
"""
import logging
import os
import random
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.services.jwt_auth import create_access_token, get_current_user, verify_token
from app.services import (
    voice_analysis_db,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
)
from app.services.voice_processor import (
    compare_to_baseline,
    determine_confidence,
    extract_acoustic_features,
    generate_narrative,
)

router = APIRouter(prefix="/api/voice", tags=["Voice Biomarker"])
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB

# ---------------------------------------------------------------------------
# Voice prompts (hardcoded for MVP)
# ---------------------------------------------------------------------------
PROMPTS = [
    {
        "id": "count",
        "type": "sequencing",
        "text": "Please count from one to twenty at your normal speaking pace.",
    },
    {
        "id": "meal",
        "type": "open_response",
        "text": "Please tell me about your favourite meal. What was it, and who were you with?",
    },
    {
        "id": "read",
        "type": "read_aloud",
        "text": (
            "Please read aloud: The sun was warm on the old stone wall. "
            "Margaret picked up her cup of tea and watched the birds in the garden. "
            "It was a quiet morning, and she was glad of it."
        ),
    },
]

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LinkRequest(BaseModel):
    resident_id: str
    facility_id: str = "default"


class BatchLinkRequest(BaseModel):
    resident_ids: list[str]
    facility_id: str = "default"


class ResidentRegisterRequest(BaseModel):
    token: str
    display_name: str
    password: str  # 4-char minimum


class ResidentLoginRequest(BaseModel):
    resident_id: str
    password: str


class AcknowledgeRequest(BaseModel):
    pass  # Empty body; auth provides the acknowledger


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------


def get_current_resident(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """Dependency: validate JWT and require role=resident."""
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    payload = verify_token(credentials.credentials)
    if payload.get("role") != "resident":
        raise HTTPException(403, "Resident access required")
    return payload


# ---------------------------------------------------------------------------
# 1-3: Link management (nurse auth)
# ---------------------------------------------------------------------------


@router.post("/links")
def generate_link(
    body: LinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a single recording link for a resident."""
    expiry_hours = getattr(settings, "VOICE_LINK_EXPIRY_HOURS", 168)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
    link = voice_link_db.create_link(
        resident_id=body.resident_id,
        facility_id=body.facility_id,
        generated_by=current_user.get("sub", ""),
        expires_at=expires_at,
    )
    base_url = getattr(settings, "VOICE_LINK_BASE_URL", "http://localhost:5173")
    token = link["token"]
    return {
        "token": token,
        "url": f"{base_url}/voice/record/{token}",
        "resident_id": body.resident_id,
        "expires_at": expires_at,
    }


@router.post("/links/batch")
def generate_links_batch(
    body: BatchLinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate recording links for multiple residents."""
    expiry_hours = getattr(settings, "VOICE_LINK_EXPIRY_HOURS", 168)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
    base_url = getattr(settings, "VOICE_LINK_BASE_URL", "http://localhost:5173")
    results = []
    for rid in body.resident_ids:
        link = voice_link_db.create_link(
            resident_id=rid,
            facility_id=body.facility_id,
            generated_by=current_user.get("sub", ""),
            expires_at=expires_at,
        )
        token = link["token"]
        results.append({
            "token": token,
            "url": f"{base_url}/voice/record/{token}",
            "resident_id": rid,
            "expires_at": expires_at,
        })
    return {"links": results}


@router.get("/links/{token}")
def validate_link(token: str):
    """Validate a recording link (no auth required). Returns link status and resident profile info."""
    link = voice_link_db.get_link(token)
    if not link:
        raise HTTPException(404, "Link not found")

    now = datetime.now(timezone.utc)
    expires_at = link.get("expires_at", "")
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        expired = now > exp
    except (ValueError, TypeError):
        expired = True

    if link.get("used"):
        # Still valid if resident already registered — they can re-use
        profile = voice_profile_db.get_by_resident_id(link["resident_id"])
        return {
            "valid": True,
            "status": "used",
            "resident_id": link["resident_id"],
            "has_account": profile is not None,
            "display_name": profile.get("display_name") if profile else None,
            "expires_at": expires_at,
        }

    if expired:
        return {
            "valid": False,
            "status": "expired",
            "resident_id": link["resident_id"],
            "message": "This link has expired. Please ask your nurse for a new one.",
        }

    # Check if resident already has an account
    profile = voice_profile_db.get_by_resident_id(link["resident_id"])
    return {
        "valid": True,
        "status": "active",
        "resident_id": link["resident_id"],
        "has_account": profile is not None,
        "display_name": profile.get("display_name") if profile else None,
        "expires_at": expires_at,
    }


# ---------------------------------------------------------------------------
# 4-5: Resident auth
# ---------------------------------------------------------------------------


@router.post("/residents/register")
def register_resident(body: ResidentRegisterRequest):
    """Create a resident voice account using a valid link token."""
    link = voice_link_db.get_link(body.token)
    if not link:
        raise HTTPException(400, "Invalid link token")

    # Check expiry
    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00"))
        if now > exp:
            raise HTTPException(400, "Link has expired")
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid link expiry")

    if len(body.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")

    resident_id = link["resident_id"]
    facility_id = link.get("facility_id", "default")

    # Check if already registered
    existing = voice_profile_db.get_by_resident_id(resident_id)
    if existing:
        raise HTTPException(400, "Account already exists. Please log in instead.")

    profile = voice_profile_db.create_profile(
        resident_id=resident_id,
        facility_id=facility_id,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )

    # Mark link as used
    voice_link_db.mark_used(body.token)

    # Issue resident JWT
    token = create_access_token({
        "sub": profile["profile_id"],
        "role": "resident",
        "profile_id": profile["profile_id"],
        "resident_id": resident_id,
        "facility_id": facility_id,
        "display_name": body.display_name,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "profile": {
            "profile_id": profile["profile_id"],
            "resident_id": resident_id,
            "display_name": body.display_name,
        },
    }


@router.post("/residents/login")
def login_resident(body: ResidentLoginRequest):
    """Authenticate a resident and return JWT."""
    profile = voice_profile_db.get_by_resident_id(body.resident_id)
    if not profile:
        raise HTTPException(401, "Account not found")

    if not verify_password(body.password, profile["password_hash"]):
        raise HTTPException(401, "Invalid password")

    token = create_access_token({
        "sub": profile["profile_id"],
        "role": "resident",
        "profile_id": profile["profile_id"],
        "resident_id": profile["resident_id"],
        "facility_id": profile.get("facility_id", ""),
        "display_name": profile.get("display_name", ""),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "profile": {
            "profile_id": profile["profile_id"],
            "resident_id": profile["resident_id"],
            "display_name": profile.get("display_name"),
        },
    }


# ---------------------------------------------------------------------------
# 6-8: Recordings (resident auth)
# ---------------------------------------------------------------------------


@router.post("/recordings")
async def upload_recording(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_resident: dict = Depends(get_current_resident),
):
    """Upload a voice recording. Triggers async analysis."""
    profile_id = current_resident.get("profile_id")
    if not profile_id:
        raise HTTPException(401, "Invalid resident token")

    content = await file.read()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "File too large (max 5 MB)")

    # Select a random prompt
    prompt = random.choice(PROMPTS)

    # Save audio to filesystem
    upload_dir = getattr(settings, "VOICE_UPLOAD_DIR", "voice_uploads")
    profile_dir = os.path.join(upload_dir, profile_id)
    os.makedirs(profile_dir, exist_ok=True)

    import uuid
    recording_id_hint = str(uuid.uuid4())
    file_path = os.path.join(profile_dir, f"{recording_id_hint}.wav")

    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except OSError:
        # Filesystem not available — use in-memory fallback
        file_path = f"memory://{recording_id_hint}"
        voice_recording_db.store_audio(recording_id_hint, content)

    # Estimate duration from WAV header
    duration_s = 0.0
    try:
        import io
        import wave
        with wave.open(io.BytesIO(content), "rb") as wf:
            duration_s = wf.getnframes() / wf.getframerate()
    except Exception:
        pass

    recording = voice_recording_db.create_recording(
        profile_id=profile_id,
        duration_s=round(duration_s, 2),
        prompt_id=prompt["id"],
        audio_file_path=file_path,
    )

    # Trigger background analysis
    background_tasks.add_task(
        _process_recording,
        recording["recording_id"],
        profile_id,
        content,
        current_resident,
    )

    return {
        "recording_id": recording["recording_id"],
        "duration_s": recording["duration_s"],
        "prompt": prompt,
        "status": "processing",
    }


@router.get("/recordings")
def list_recordings(current_resident: dict = Depends(get_current_resident)):
    """List the resident's own recordings."""
    profile_id = current_resident.get("profile_id")
    recordings = voice_recording_db.list_recordings(profile_id)
    return {"recordings": recordings}


@router.delete("/recordings/{recording_id}")
def delete_recording(
    recording_id: str,
    current_resident: dict = Depends(get_current_resident),
):
    """Delete a resident's own recording."""
    profile_id = current_resident.get("profile_id")
    rec = voice_recording_db.get_recording(profile_id, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    # Delete audio file from filesystem
    path = rec.get("audio_file_path", "")
    if path and not path.startswith("memory://"):
        try:
            os.remove(path)
        except OSError:
            pass

    voice_recording_db.delete_recording(profile_id, recording_id)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Prompt endpoint (public — no auth, used by recording page)
# ---------------------------------------------------------------------------


@router.get("/prompts/random")
def get_random_prompt():
    """Return a random voice prompt for the recording session."""
    return random.choice(PROMPTS)


# ---------------------------------------------------------------------------
# 9-12: Analysis & alerts (nurse auth)
# ---------------------------------------------------------------------------


@router.get("/analysis/{resident_id}")
def get_analysis(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the latest voice analysis for a resident."""
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if not profile:
        raise HTTPException(404, "Resident voice profile not found")

    analysis = voice_analysis_db.get_latest(profile["profile_id"])
    if not analysis:
        raise HTTPException(404, "No analysis results yet")
    return analysis


@router.get("/analysis/{resident_id}/history")
def get_analysis_history(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all voice analyses for a resident (for trend charts)."""
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if not profile:
        raise HTTPException(404, "Resident voice profile not found")

    analyses = voice_analysis_db.list_analyses(profile["profile_id"])
    return {"analyses": analyses, "profile": {
        "profile_id": profile["profile_id"],
        "resident_id": resident_id,
        "display_name": profile.get("display_name"),
        "baseline_established": profile.get("baseline_established", False),
        "recording_count": profile.get("baseline_recording_count", 0),
    }}


@router.get("/alerts")
def get_alerts(current_user: dict = Depends(get_current_user)):
    """Get unacknowledged voice biomarker alerts."""
    alerts = voice_analysis_db.list_alerts(facility_id=None, acknowledged=False)
    return {"alerts": alerts}


@router.put("/alerts/{analysis_id}/acknowledge")
def acknowledge_alert(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Acknowledge a voice biomarker alert."""
    # Find the analysis to get profile_id
    # Try all profiles — alerts list already gives us the data
    alerts = voice_analysis_db.list_alerts(acknowledged=False)
    target = next((a for a in alerts if a["analysis_id"] == analysis_id), None)
    if not target:
        raise HTTPException(404, "Alert not found or already acknowledged")

    success = voice_analysis_db.acknowledge_alert(
        profile_id=target["profile_id"],
        analysis_id=analysis_id,
        acknowledged_by=current_user.get("sub", ""),
    )
    if not success:
        raise HTTPException(500, "Failed to acknowledge alert")
    return {"acknowledged": True}


# ---------------------------------------------------------------------------
# Facility summary (nurse auth)
# ---------------------------------------------------------------------------


@router.get("/facility/summary")
def facility_summary(current_user: dict = Depends(get_current_user)):
    """Aggregate voice biomarker stats across all residents."""
    # Get all profiles (facility-wide)
    # For MVP, we list all profiles since facility_id filtering is optional
    all_alerts = voice_analysis_db.list_alerts(acknowledged=False)
    # Count unique profiles with recordings
    # This is a simple summary for the dashboard header
    return {
        "active_alerts": len(all_alerts),
        "red_alerts": len([a for a in all_alerts if a["alert_level"] == "red"]),
        "amber_alerts": len([a for a in all_alerts if a["alert_level"] == "amber"]),
    }


@router.get("/residents")
def list_voice_residents(current_user: dict = Depends(get_current_user)):
    """List all residents with voice profiles (for nurse dashboard)."""
    # For MVP, list all profiles (no facility filter)
    profiles = []
    # Get from in-memory or Azure
    # We need to scan all profiles — use a broad query
    table = voice_profile_db._get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter="PartitionKey eq 'resident'"
            ))
            profiles = [voice_profile_db._entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("list_voice_residents: %s", e)
    else:
        profiles = [dict(p) for p in voice_profile_db._in_memory.values()]

    # Attach latest analysis to each profile
    result = []
    for p in profiles:
        latest = voice_analysis_db.get_latest(p["profile_id"])
        result.append({
            "profile_id": p["profile_id"],
            "resident_id": p.get("resident_id"),
            "display_name": p.get("display_name"),
            "last_recording_date": p.get("last_recording_date"),
            "baseline_established": p.get("baseline_established", False),
            "recording_count": p.get("baseline_recording_count", 0),
            "latest_analysis": latest,
        })

    return {"residents": result}


# ---------------------------------------------------------------------------
# Background task: process recording
# ---------------------------------------------------------------------------


def _process_recording(
    recording_id: str,
    profile_id: str,
    audio_bytes: bytes,
    resident_payload: dict,
):
    """Background task: extract features, compare baseline, store analysis."""
    try:
        voice_recording_db.update_status(profile_id, recording_id, "processing")

        # Extract acoustic features
        features = extract_acoustic_features(audio_bytes)
        logger.info("Extracted features for %s: %s", recording_id, features)

        # Get existing analyses for baseline comparison
        existing = voice_analysis_db.list_analyses(profile_id)
        baseline_analysis = existing[-1] if existing else None  # Oldest = baseline

        risk_scores = {}
        alert_level = "green"
        if baseline_analysis:
            baseline_features = baseline_analysis.get("acoustic_features", {})
            risk_scores = compare_to_baseline(features, baseline_features)
            alert_level = risk_scores.get("alert_level", "green")

        recording_count = len(existing) + 1
        confidence = determine_confidence(recording_count)
        narrative = generate_narrative(features, risk_scores if baseline_analysis else None)

        # Store analysis
        voice_analysis_db.create_analysis(
            recording_id=recording_id,
            profile_id=profile_id,
            acoustic_features=features,
            risk_scores=risk_scores,
            narrative_report=narrative,
            alert_level=alert_level,
            confidence=confidence,
            facility_id=resident_payload.get("facility_id"),
            resident_id=resident_payload.get("resident_id"),
            display_name=resident_payload.get("display_name"),
        )

        # Update recording status
        voice_recording_db.update_status(profile_id, recording_id, "analyzed")

        # Update profile metadata
        voice_profile_db.update_profile(profile_id, {
            "last_recording_date": datetime.now(timezone.utc).isoformat(),
            "baseline_recording_count": recording_count,
            "baseline_established": recording_count >= 2,
        })

        logger.info(
            "Analysis complete for recording %s: alert_level=%s",
            recording_id,
            alert_level,
        )

    except Exception:
        logger.exception("Failed to process recording %s", recording_id)
        voice_recording_db.update_status(profile_id, recording_id, "failed")
