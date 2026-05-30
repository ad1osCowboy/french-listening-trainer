"""
Routes for question segments and sentence segments.
Handles: CRUD for segments, generating sentences via DeepSeek, audio splitting.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import QuestionSegment, ListeningSession, SentenceSegment
from schemas import (
    SegmentCreate, SegmentResponse, SegmentDetailResponse,
    SentenceResponse, SentenceUpdate,
)
from services.audio_service import split_audio, SEGMENT_DIR, SENTENCE_DIR, get_audio_url_for_segment, get_audio_url_for_sentence, check_ffmpeg
from services.transcription_service import transcribe_audio, translate_french_to_english
import uuid

router = APIRouter(tags=["segments"])


# ── Question Segments ──────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/segments", response_model=SegmentResponse)
def create_segment(session_id: int, data: SegmentCreate, db: Session = Depends(get_db)):
    """Create a question segment with start/end time. Extracts audio if ffmpeg available."""
    session = db.query(ListeningSession).filter(
        ListeningSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="start_time must be < end_time")

    audio_path = None
    if session.audio_file_path:
        if check_ffmpeg()["available"]:
            seg_filename = f"seg_{session_id}_q{data.question_number}_{uuid.uuid4().hex[:6]}.mp3"
            seg_path = str(SEGMENT_DIR / seg_filename)
            try:
                split_audio(session.audio_file_path, data.start_time, data.end_time, seg_path)
                audio_path = seg_path
            except Exception as e:
                print(f"[WARN] Audio extraction failed (non-fatal): {e}")
                audio_path = get_audio_url_for_segment(session.audio_file_path)
        else:
            print(f"[INFO] ffmpeg not available — using full audio as fallback for Q{data.question_number}")
            audio_path = get_audio_url_for_segment(session.audio_file_path)

    segment = QuestionSegment(
        session_id=session_id,
        question_number=data.question_number,
        start_time=data.start_time,
        end_time=data.end_time,
        audio_file_path=audio_path,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.get("/api/sessions/{session_id}/segments", response_model=list[SegmentDetailResponse])
def list_segments(session_id: int, db: Session = Depends(get_db)):
    """List all segments for a session with nested sentences, ordered by question number."""
    return db.query(QuestionSegment).filter(
        QuestionSegment.session_id == session_id
    ).order_by(QuestionSegment.question_number).all()


@router.get("/api/segments/{segment_id}", response_model=SegmentDetailResponse)
def get_segment(segment_id: int, db: Session = Depends(get_db)):
    """Get a segment with its nested sentences."""
    segment = db.query(QuestionSegment).filter(
        QuestionSegment.id == segment_id
    ).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment


@router.delete("/api/segments/{segment_id}")
def delete_segment(segment_id: int, db: Session = Depends(get_db)):
    """Delete a segment and its sentences."""
    segment = db.query(QuestionSegment).filter(
        QuestionSegment.id == segment_id
    ).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    db.delete(segment)
    db.commit()
    return {"message": "Segment deleted"}


# ── Sentence Generation & Management ───────────────────────────────

@router.post("/api/segments/{segment_id}/generate-sentences", response_model=list[SentenceResponse])
def generate_sentences(segment_id: int, db: Session = Depends(get_db)):
    """
    Generate sentence-level segments from a question segment.
    Uses DeepSeek API for transcription (falls back to mock if unavailable).
    Also splits audio into per-sentence clips if segment audio exists.
    """
    segment = db.query(QuestionSegment).filter(
        QuestionSegment.id == segment_id
    ).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Delete existing sentences for this segment (re-generate)
    db.query(SentenceSegment).filter(
        SentenceSegment.question_segment_id == segment_id
    ).delete()

    duration = segment.end_time - segment.start_time

    if segment.audio_file_path:
        try:
            sentences_data = transcribe_audio(segment.audio_file_path, duration)
        except RuntimeError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        sentences_data = []

    sentences = []
    for s in sentences_data:
        sent_audio = None
        if segment.audio_file_path:
            if check_ffmpeg()["available"]:
                sent_filename = f"sent_{segment_id}_{s['index']}_{uuid.uuid4().hex[:6]}.mp3"
                sent_path = str(SENTENCE_DIR / sent_filename)
                try:
                    split_audio(segment.audio_file_path, s["start_time"], s["end_time"], sent_path)
                    sent_audio = sent_path
                except Exception as e:
                    print(f"[WARN] Sentence audio split failed (non-fatal): {e}")
                    sent_audio = get_audio_url_for_sentence(segment.audio_file_path)
            else:
                sent_audio = get_audio_url_for_sentence(segment.audio_file_path)

        sentence = SentenceSegment(
            question_segment_id=segment_id,
            sentence_index=s["index"],
            start_time=s["start_time"],
            end_time=s["end_time"],
            french_text=s["french_text"],
            english_translation=s["english_translation"],
            audio_file_path=sent_audio,
        )
        db.add(sentence)
        sentences.append(sentence)

    db.commit()
    for s in sentences:
        db.refresh(s)

    return sentences


@router.get("/api/segments/{segment_id}/sentences", response_model=list[SentenceResponse])
def list_sentences(segment_id: int, db: Session = Depends(get_db)):
    """List all sentences for a segment, in order."""
    return db.query(SentenceSegment).filter(
        SentenceSegment.question_segment_id == segment_id
    ).order_by(SentenceSegment.sentence_index).all()


@router.put("/api/sentences/{sentence_id}", response_model=SentenceResponse)
def update_sentence(sentence_id: int, data: SentenceUpdate, db: Session = Depends(get_db)):
    """Update sentence fields: french_text, english_translation, is_mastered."""
    sentence = db.query(SentenceSegment).filter(
        SentenceSegment.id == sentence_id
    ).first()
    if not sentence:
        raise HTTPException(status_code=404, detail="Sentence not found")

    if data.is_mastered is not None:
        sentence.is_mastered = data.is_mastered
    if data.french_text is not None:
        sentence.french_text = data.french_text
    if data.english_translation is not None:
        sentence.english_translation = data.english_translation

    db.commit()
    db.refresh(sentence)
    return sentence


@router.post("/api/sentences/{sentence_id}/retranslate", response_model=SentenceResponse)
def retranslate_sentence(sentence_id: int, db: Session = Depends(get_db)):
    """
    Regenerate the English translation for a sentence using its current
    French text via DeepSeek.
    """
    sentence = db.query(SentenceSegment).filter(
        SentenceSegment.id == sentence_id
    ).first()
    if not sentence:
        raise HTTPException(status_code=404, detail="Sentence not found")

    if not sentence.french_text:
        raise HTTPException(status_code=400, detail="Sentence has no French text to translate")

    try:
        translation = translate_french_to_english(sentence.french_text)
        sentence.english_translation = translation
        db.commit()
        db.refresh(sentence)
        return sentence
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
