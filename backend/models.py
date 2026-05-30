"""
SQLAlchemy ORM models for all data tables.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class ListeningSession(Base):
    __tablename__ = "listening_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    audio_file_path = Column(String, nullable=True)
    youtube_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segments = relationship("QuestionSegment", back_populates="session", cascade="all, delete-orphan")


class QuestionSegment(Base):
    __tablename__ = "question_segments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("listening_sessions.id"), nullable=False)
    question_number = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)   # seconds from audio start
    end_time = Column(Float, nullable=False)     # seconds from audio start
    audio_file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ListeningSession", back_populates="segments")
    sentences = relationship("SentenceSegment", back_populates="question_segment", cascade="all, delete-orphan")


class SentenceSegment(Base):
    __tablename__ = "sentence_segments"

    id = Column(Integer, primary_key=True, index=True)
    question_segment_id = Column(Integer, ForeignKey("question_segments.id"), nullable=False)
    sentence_index = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    french_text = Column(Text, nullable=True)
    english_translation = Column(Text, nullable=True)
    audio_file_path = Column(String, nullable=True)
    is_mastered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    question_segment = relationship("QuestionSegment", back_populates="sentences")
    vocabulary_items = relationship("VocabularyItem", back_populates="sentence_segment", cascade="all, delete-orphan")


class VocabularyItem(Base):
    __tablename__ = "vocabulary_items"

    id = Column(Integer, primary_key=True, index=True)
    sentence_segment_id = Column(Integer, ForeignKey("sentence_segments.id"), nullable=True)
    word = Column(String, nullable=False)
    translation = Column(String, nullable=True)
    context_sentence = Column(Text, nullable=True)
    is_mastered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sentence_segment = relationship("SentenceSegment", back_populates="vocabulary_items")
    review_logs = relationship("ReviewLog", back_populates="vocabulary_item", cascade="all, delete-orphan")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    vocabulary_item_id = Column(Integer, ForeignKey("vocabulary_items.id"), nullable=False)
    reviewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    result = Column(String, nullable=True)  # "remembered" | "forgot" | "mastered"

    vocabulary_item = relationship("VocabularyItem", back_populates="review_logs")
