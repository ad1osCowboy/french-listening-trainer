"""
Audio processing utilities using FFmpeg for segment extraction.
"""

import subprocess
from pathlib import Path

UPLOAD_DIR = Path("uploads")
SEGMENT_DIR = Path("uploads/segments")
SENTENCE_DIR = Path("uploads/sentences")

FFMPEG_PATH = "/usr/local/bin/ffmpeg"

for d in [UPLOAD_DIR, SEGMENT_DIR, SENTENCE_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def check_ffmpeg() -> dict:
    """Diagnostic: verify ffmpeg exists and is executable. Returns status dict."""
    ffmpeg = Path(FFMPEG_PATH)
    if not ffmpeg.exists():
        return {
            "available": False,
            "path": FFMPEG_PATH,
            "error": f"ffmpeg not found at {FFMPEG_PATH}. Install with: brew install ffmpeg",
        }
    if not ffmpeg.is_file():
        return {
            "available": False,
            "path": FFMPEG_PATH,
            "error": f"{FFMPEG_PATH} exists but is not a regular file.",
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
