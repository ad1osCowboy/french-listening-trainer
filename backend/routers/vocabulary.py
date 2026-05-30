"""
Routes for vocabulary management and review logging.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import VocabularyItem, ReviewLog
from schemas import (
    VocabularyCreate, VocabularyResponse, VocabularyUpdate,
    ReviewCreate, ReviewResponse,
)
from services.translation_service import mock_translate_word

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


@router.post("/", response_model=VocabularyResponse)
def add_vocabulary(data: VocabularyCreate, db: Session = Depends(get_db)):
    """
    Add a word to the vocabulary notebook.
    If no translation provided, uses mock translation automatically.
    """
    translation = data.translation or mock_translate_word(data.word)

    vocab = VocabularyItem(
        word=data.word,
        translation=translation,
        context_sentence=data.context_sentence,
        sentence_segment_id=data.sentence_segment_id,
    )
    db.add(vocab)
    db.commit()
    db.refresh(vocab)
    return vocab


@router.get("/", response_model=list[VocabularyResponse])
def list_vocabulary(
    mastered: str = Query(None, description="Filter: 'true', 'false', or omit for all"),
    db: Session = Depends(get_db),
):
    """List vocabulary items, optionally filtered by mastered status."""
    query = db.query(VocabularyItem).order_by(VocabularyItem.created_at.desc())

    if mastered == "true":
        query = query.filter(VocabularyItem.is_mastered == True)
    elif mastered == "false":
        query = query.filter(VocabularyItem.is_mastered == False)

    return query.all()


@router.put("/{vocab_id}", response_model=VocabularyResponse)
def update_vocabulary(vocab_id: int, data: VocabularyUpdate, db: Session = Depends(get_db)):
    """Update a vocabulary item (mark mastered, update translation)."""
    vocab = db.query(VocabularyItem).filter(VocabularyItem.id == vocab_id).first()
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")

    if data.is_mastered is not None:
        vocab.is_mastered = data.is_mastered
    if data.translation is not None:
        vocab.translation = data.translation

    db.commit()
    db.refresh(vocab)
    return vocab


@router.delete("/{vocab_id}")
def delete_vocabulary(vocab_id: int, db: Session = Depends(get_db)):
    """Remove a word from the vocabulary notebook."""
    vocab = db.query(VocabularyItem).filter(VocabularyItem.id == vocab_id).first()
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")
    db.delete(vocab)
    db.commit()
    return {"message": "Deleted"}


# ── Review Logs ────────────────────────────────────────────────────

@router.post("/{vocab_id}/review", response_model=ReviewResponse)
def review_vocabulary(vocab_id: int, data: ReviewCreate, db: Session = Depends(get_db)):
    """
    Log a review attempt for spaced repetition tracking.
    result = "remembered" | "forgot" | "mastered"
    """
    vocab = db.query(VocabularyItem).filter(VocabularyItem.id == vocab_id).first()
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")

    if data.result == "mastered":
        vocab.is_mastered = True

    review = ReviewLog(vocabulary_item_id=vocab_id, result=data.result)
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.get("/{vocab_id}/reviews", response_model=list[ReviewResponse])
def get_reviews(vocab_id: int, db: Session = Depends(get_db)):
    """Get review history for a vocabulary item."""
    return db.query(ReviewLog).filter(
        ReviewLog.vocabulary_item_id == vocab_id
    ).order_by(ReviewLog.reviewed_at.desc()).all()


@router.get("/due/today", response_model=list[VocabularyResponse])
def get_due_reviews(db: Session = Depends(get_db)):
    """
    Get vocabulary items due for review today.
    Simplified: returns all non-mastered items. In production, implement
    proper spaced-repetition scheduling (SM-2 algorithm).
    """
    return db.query(VocabularyItem).filter(
        VocabularyItem.is_mastered == False
    ).order_by(VocabularyItem.created_at).all()
