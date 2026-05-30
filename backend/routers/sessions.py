"""
Routes for listening sessions: create, list, get, delete, upload audio.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import ListeningSession
from schemas import SessionCreate, SessionResponse, SessionDetailResponse
from services.audio_service import UPLOAD_DIR
import shutil
import uuid

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("/", response_model=SessionResponse)
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    """Create a new listening session with title and optional YouTube URL."""
    session = ListeningSession(**data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/", response_model=list[SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    """List all sessions, newest first."""
    return db.query(ListeningSession).order_by(
        ListeningSession.created_at.desc()
    ).all()


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a session with its nested question segments."""
    session = db.query(ListeningSession).filter(
        ListeningSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/upload-audio")
async def upload_audio(
    session_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an audio file (mp3, wav, m4a) for a session."""
    session = db.query(ListeningSession).filter(
        ListeningSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    ext = (file.filename or "audio.mp3").rsplit(".", 1)[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    session.audio_file_path = str(file_path)
    db.commit()
    db.refresh(session)

    return {
        "message": "Audio uploaded",
        "file_path": str(file_path),
        "filename": file.filename,
    }


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a session and all its segments, sentences, and vocabulary."""
    session = db.query(ListeningSession).filter(
        ListeningSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}
