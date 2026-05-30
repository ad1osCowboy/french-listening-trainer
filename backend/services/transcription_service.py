"""
Transcription service using Deepgram Speech-to-Text for real French audio
transcription, and DeepSeek for French-to-English translation.

Environment variables required:
  DEEPGRAM_API_KEY — Deepgram API key
  DEEPSEEK_API_KEY — DeepSeek API key
"""

import os
import json
import urllib.request
import urllib.error
from pathlib import Path
from openai import OpenAI

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

_deepseek_client = None


def _get_deepseek_client():
    global _deepseek_client
    if _deepseek_client is None and DEEPSEEK_API_KEY:
        _deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    return _deepseek_client


def check_api_key() -> dict:
    """Diagnostic: verify both API keys are configured."""
    result = {"deepgram": {}, "deepseek": {}}

    if DEEPGRAM_API_KEY:
        result["deepgram"] = {
            "configured": True,
            "key_prefix": DEEPGRAM_API_KEY[:7] + "...",
        }
    else:
        result["deepgram"] = {
            "configured": False,
            "error": "DEEPGRAM_API_KEY environment variable is not set.",
        }

    if DEEPSEEK_API_KEY:
        result["deepseek"] = {
            "configured": True,
            "key_prefix": DEEPSEEK_API_KEY[:7] + "...",
        }
    else:
        result["deepseek"] = {
            "configured": False,
            "error": "DEEPSEEK_API_KEY environment variable is not set.",
        }

    return result


def transcribe_audio(audio_path: str, duration_seconds: float) -> list[dict]:
    """
    Transcribe a French audio clip using Deepgram STT, then translate via DeepSeek.

    Pipeline: audio file → Deepgram STT → DeepSeek translation → sentence list

    Returns: list of {index, start_time, end_time, french_text, english_translation}
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("No Deepgram API key configured")

    transcript = _deepgram_transcribe(audio_path, duration_seconds)

    if DEEPSEEK_API_KEY and transcript:
        transcript = _deepseek_translate(transcript)
    elif not DEEPSEEK_API_KEY:
        print("[WARN] DEEPSEEK_API_KEY not set — skipping translation.")

    return transcript


def _detect_mime(audio_path: str) -> str:
    ext = Path(audio_path).suffix.lower()
    mapping = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
    }
    return mapping.get(ext, "audio/mpeg")


def _deepgram_transcribe(audio_path: str, duration_seconds: float) -> list[dict]:
    """Send audio to Deepgram STT API for French transcription."""
    print("Clip path:", audio_path)
    print("Clip duration:", duration_seconds)

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    url = (
        "https://api.deepgram.com/v1/listen"
        "?language=fr"
        "&smart_format=true"
        "&punctuate=true"
        "&utterances=true"
        "&diarize=false"
    )

    mime = _detect_mime(audio_path)

    req = urllib.request.Request(url, data=audio_data)
    req.add_header("Authorization", f"Token {DEEPGRAM_API_KEY}")
    req.add_header("Content-Type", mime)

    try:
        response = urllib.request.urlopen(req)
        raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"Speech-to-text failed: HTTP {e.code} — {body[:300]}")
    except Exception as e:
        raise RuntimeError(f"Speech-to-text failed: {e}")

    print("Raw Deepgram response:", raw[:500] + "..." if len(raw) > 500 else raw)

    data = json.loads(raw)
    results = data.get("results", {})
    utterances = results.get("utterances", [])

    if not utterances:
        channels = results.get("channels", [])
        if channels:
            alternatives = channels[0].get("alternatives", [])
            if alternatives:
                full_transcript = alternatives[0].get("transcript", "")
                if not full_transcript.strip():
                    raise RuntimeError("Speech-to-text failed: empty transcript")
                return [{
                    "index": 0,
                    "start_time": 0.0,
                    "end_time": round(duration_seconds, 2),
                    "french_text": full_transcript.strip(),
                    "english_translation": None,
                }]
        raise RuntimeError("Speech-to-text failed: no utterances or transcript")

    sentences = []
    for i, utterance in enumerate(utterances):
        french_text = utterance.get("transcript", "").strip()
        if not french_text:
            continue
        sentences.append({
            "index": i,
            "start_time": round(utterance.get("start", 0), 2),
            "end_time": round(utterance.get("end", 0), 2),
            "french_text": french_text,
            "english_translation": None,
        })

    if not sentences:
        raise RuntimeError("Speech-to-text failed: no transcript produced")

    print("French transcript:", " | ".join(s["french_text"] for s in sentences))

    return sentences


def translate_french_to_english(french_text: str) -> str:
    """
    Translate a single French sentence to English via DeepSeek.
    Returns the English translation string, or raises RuntimeError on failure.
    """
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("No DeepSeek API key configured")

    client = _get_deepseek_client()
    if not client:
        raise RuntimeError("Translation failed: DeepSeek client unavailable")

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a French-to-English translator. "
                        "Translate the French text below into natural English. "
                        "Output only the English translation — do not rewrite, "
                        "summarize, or add commentary."
                    ),
                },
                {"role": "user", "content": french_text},
            ],
            temperature=0.3,
        )

        translation = response.choices[0].message.content.strip()
        print("DeepSeek retranslation:", translation)
        return translation

    except Exception as e:
        raise RuntimeError(f"Translation failed: {e}")


def _deepseek_translate(sentences: list[dict]) -> list[dict]:
    """Translate French sentences to English via DeepSeek. Translate only."""
    client = _get_deepseek_client()
    if not client:
        print("[WARN] DeepSeek client not available — skipping translation.")
        return sentences

    french_texts = [s["french_text"] for s in sentences]
    joined = "\n---\n".join(french_texts)

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a French-to-English translator. "
                        "Translate each French sentence below into natural English. "
                        "Output one translation per line in the same order, "
                        "separated by '---' markers. "
                        "Translate only — do not rewrite, summarize, or add commentary."
                    ),
                },
                {"role": "user", "content": joined},
            ],
            temperature=0.3,
        )

        content = response.choices[0].message.content.strip()
        print("DeepSeek translation:", content[:500] + "..." if len(content) > 500 else content)

        translations = [t.strip() for t in content.split("---")]

        for i, s in enumerate(sentences):
            if i < len(translations) and translations[i]:
                s["english_translation"] = translations[i]
            else:
                s["english_translation"] = "Translation failed"

    except Exception as e:
        print(f"[WARN] DeepSeek translation error: {e}")
        for s in sentences:
            if not s.get("english_translation"):
                s["english_translation"] = "Translation failed"

    return sentences
