"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Listening Session ──────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str
    youtube_url: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    title: str
    audio_file_path: Optional[str] = None
    youtube_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Question Segment ───────────────────────────────────────────────

class SegmentCreate(BaseModel):
    question_number: int
    start_time: float   # seconds
    end_time: float     # seconds


class SegmentResponse(BaseModel):
    id: int
    session_id: int
    question_number: int
    start_time: float
    end_time: float
    audio_file_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Sentence Segment ───────────────────────────────────────────────

class SentenceResponse(BaseModel):
    id: int
    question_segment_id: int
    sentence_index: int
    start_time: float
    end_time: float
    french_text: Optional[str] = None
    english_translation: Optional[str] = None
    audio_file_path: Optional[str] = None
    is_mastered: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class SentenceUpdate(BaseModel):
    is_mastered: Optional[bool] = None
    french_text: Optional[str] = None
    english_translation: Optional[str] = None


# ── Vocabulary ─────────────────────────────────────────────────────

class VocabularyCreate(BaseModel):
    word: str
    translation: Optional[str] = None
    context_sentence: Optional[str] = None
    sentence_segment_id: Optional[int] = None


class VocabularyResponse(BaseModel):
    id: int
    sentence_segment_id: Optional[int] = None
    word: str
    translation: Optional[str] = None
    context_sentence: Optional[str] = None
    is_mastered: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class VocabularyUpdate(BaseModel):
    is_mastered: Optional[bool] = None
    translation: Optional[str] = None


# ── Review Log ─────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    result: str  # "remembered" | "forgot" | "mastered"


class ReviewResponse(BaseModel):
    id: int
    vocabulary_item_id: int
    reviewed_at: datetime
    result: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Composite responses (session with nested data) ─────────────────

class SessionDetailResponse(SessionResponse):
    segments: list[SegmentResponse] = []


class SegmentDetailResponse(SegmentResponse):
    sentences: list[SentenceResponse] = []
