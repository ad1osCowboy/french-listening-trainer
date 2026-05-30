"""
Audio processing utilities using FFmpeg for segment extraction.
"""

import os
import shutil
import subprocess
from pathlib import Path

UPLOAD_DIR = Path("uploads")
SEGMENT_DIR = Path("uploads/segments")
SENTENCE_DIR = Path("uploads/sentences")


def _resolve_ffmpeg() -> str:
    """Find ffmpeg on the current platform. Falls back to common paths."""
    env_path = os.getenv("FFMPEG_PATH")
    if env_path:
        return env_path
    in_path = shutil.which("ffmpeg")
    if in_path:
        return in_path
    for candidate in ["/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]:
        if Path(candidate).exists():
            return candidate
    return "ffmpeg"  # last-resort: hope it's on PATH at runtime


FFMPEG_PATH = _resolve_ffmpeg()

for d in [UPLOAD_DIR, SEGMENT_DIR, SENTENCE_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def check_ffmpeg() -> dict:
    """Diagnostic: verify ffmpeg exists and is executable. Returns status dict."""
    ffmpeg = Path(FFMPEG_PATH) if FFMPEG_PATH != "ffmpeg" else None
    if ffmpeg and not ffmpeg.exists():
        return {
            "available": False,
            "path": FFMPEG_PATH,
            "error": f"ffmpeg not found (checked PATH and common locations).",
        }
    if ffmpeg and not ffmpeg.is_file():
        return {
            "available": False,
            "path": FFMPEG_PATH,
            "error": f"{FFMPEG_PATH} exists but is not a regular file.",
        }
    if not ffmpeg:
        return {
            "available": False,
            "path": "ffmpeg (PATH lookup)",
            "error": "ffmpeg not found on PATH or in common locations.",
        }
    try:
        result = subprocess.run([FFMPEG_PATH, "-version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.strip().split("\n")[0]
            return {"available": True, "path": FFMPEG_PATH, "version": version_line}
        return {"available": False, "path": FFMPEG_PATH, "error": "ffmpeg binary returned non-zero exit code."}
    except Exception as e:
        return {"available": False, "path": FFMPEG_PATH, "error": str(e)}


def split_audio(input_path: str, start_time: float, end_time: float, output_path: str) -> str:
    """Extract an audio segment using FFmpeg."""
    duration = end_time - start_time
    cmd = [
        FFMPEG_PATH, "-y", "-loglevel", "error",
        "-ss", str(start_time),
        "-i", input_path,
        "-t", str(duration),
        "-c", "copy",
        output_path,
    ]
    subprocess.run(cmd, check=True)
    return output_path


def get_audio_url_for_segment(session_audio_path: str) -> str | None:
    """Return the session's full audio path as fallback."""
    if not session_audio_path:
        return None
    return session_audio_path


def get_audio_url_for_sentence(segment_audio_path: str) -> str | None:
    """Return the best available audio for a sentence."""
    return segment_audio_path


def parse_time_to_seconds(time_str: str) -> float:
    """Parse 'MM:SS' or 'HH:MM:SS' into total seconds."""
    parts = time_str.strip().split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    raise ValueError(f"Invalid time format: {time_str}")
