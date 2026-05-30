"""
French Listening Trainer — FastAPI Backend
Local: uvicorn main:app --reload --host 0.0.0.0 --port 8000
Production: uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import os
import sys
from pathlib import Path

# Load .env from project root BEFORE any other imports that need env vars
from dotenv import load_dotenv

# Project root is parent of backend/ (local dev) or backend/ itself (Render)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()  # fallback: cwd or backend/ directory

PORT = int(os.getenv("PORT", 5000))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db
from routers import sessions, segments, vocabulary
from services.audio_service import check_ffmpeg
from services.transcription_service import check_api_key

app = FastAPI(title="French Listening Trainer API", version="0.1.0")

# CORS — allow all origins for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded audio files statically at /audio/<path>
os.makedirs("uploads", exist_ok=True)
app.mount("/audio", StaticFiles(directory="uploads"), name="audio")

# Register route modules
app.include_router(sessions.router)
app.include_router(segments.router)
app.include_router(vocabulary.router)


@app.on_event("startup")
def on_startup():
    """Initialize DB and run startup diagnostics."""
    print("=" * 60)
    print("  French Listening Trainer — Startup Diagnostics")
    print("=" * 60)

    # 1. Database
    init_db()
    print("  [OK] Database initialized.")

    # 2. FFmpeg check
    ffmpeg_status = check_ffmpeg()
    if ffmpeg_status["available"]:
        print(f"  [OK] FFmpeg found: {ffmpeg_status['version']}")
    else:
        print(f"  [WARN] FFmpeg: {ffmpeg_status['error']}")
        print(f"         Audio segment extraction will use full-audio fallback.")

    # 3. API key checks
    api_status = check_api_key()

    dg = api_status.get("deepgram", {})
    if dg.get("configured"):
        print(f"  [OK] Deepgram API key: {dg['key_prefix']}")
    else:
        print(f"  [FAIL] Deepgram: {dg.get('error', 'unknown error')}")
        print(f"         Create a .env file in the project root with DEEPGRAM_API_KEY.")

    ds = api_status.get("deepseek", {})
    if ds.get("configured"):
        print(f"  [OK] DeepSeek API key: {ds['key_prefix']}")
    else:
        print(f"  [FAIL] DeepSeek: {ds.get('error', 'unknown error')}")
        print(f"         Create a .env file in the project root with DEEPSEEK_API_KEY.")
        print(f"         Transcription will not have English translations.")

    # 4. Uploads directory
    uploads = Path("uploads")
    print(f"  [OK] Uploads directory: {uploads.resolve()} (exists={uploads.exists()})")

    # 5. Port
    print(f"  [OK] Server will listen on port {PORT}")

    print("=" * 60)


@app.get("/health")
def root_health():
    """Simple health check for Render / load balancers."""
    return {
        "status": "ok",
        "service": "french-listening-backend",
    }


@app.get("/api/health")
def health():
    """Health check with diagnostic info."""
    ffmpeg_status = check_ffmpeg()
    api_status = check_api_key()
    return {
        "status": "ok",
        "app": "French Listening Trainer",
        "ffmpeg": ffmpeg_status,
        "deepgram_api": api_status.get("deepgram", {}),
        "deepseek_api": api_status.get("deepseek", {}),
    }


@app.get("/api/diagnostics")
def diagnostics():
    """Full startup diagnostics endpoint."""
    ffmpeg_status = check_ffmpeg()
    api_status = check_api_key()

    return {
        "ffmpeg": ffmpeg_status,
        "deepgram_api": api_status.get("deepgram", {}),
        "deepseek_api": api_status.get("deepseek", {}),
        "python_version": sys.version,
        "uploads_dir": str(Path("uploads").resolve()),
        "env_file_loaded": ENV_FILE.exists() if ENV_FILE else False,
    }


if __name__ == "__main__":
    import uvicorn
    print(f"Starting server on 0.0.0.0:{PORT}")
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
