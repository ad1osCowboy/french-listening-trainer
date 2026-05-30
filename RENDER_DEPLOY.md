# Render Deployment Guide — French Listening Trainer

## Architecture
- **Backend:** FastAPI (Python) → deployed on Render
- **Frontend:** Expo / React Native → runs on iPhone
- **Database:** SQLite (ephemeral on Render free tier)

---

## 1. Push code to GitHub

```bash
cd /Users/thearchitect/Documents/PlatformIO/Projects/french_listening_trainer
git init
git add .
git commit -m "Ready for Render deployment"
git remote add origin https://github.com/YOUR_USERNAME/french-listening-trainer.git
git push -u origin main
```

---

## 2. Create a Web Service on Render

Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.

Connect your GitHub repo and configure:

| Setting | Value |
|---------|-------|
| **Name** | `french-listening-backend` |
| **Region** | Oregon (US West) |
| **Runtime** | Python 3 |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

> The repo root contains `.python-version` which pins Python to 3.12.
> Render defaults to Python 3.14 for new services, but pydantic-core
> has no pre-built wheels for 3.14 yet, causing source-build failures
> on Render's read-only filesystem. Do NOT remove this file.
>
> For extra safety, also set the env var: `PYTHON_VERSION` = `3.12.13`

---

## 3. Environment Variables

In Render: **Environment** → add these:

| Key | Value |
|-----|-------|
| `DEEPGRAM_API_KEY` | Your Deepgram API key |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |

> `PORT` is set automatically by Render. Do NOT add it manually.

---

## 4. After deployment

Render gives you a URL like:
```
https://french-listening-backend.onrender.com
```

### Test the backend

```bash
# Health check (simple)
curl https://french-listening-backend.onrender.com/health

# Health check (with diagnostics)
curl https://french-listening-backend.onrender.com/api/health

# Full diagnostics
curl https://french-listening-backend.onrender.com/api/diagnostics
```

Expected `/health` response:
```json
{"status":"ok","service":"french-listening-backend"}
```

---

## 5. Connect Expo frontend to Render

Create `frontend/.env` from the example:

```
EXPO_PUBLIC_API_BASE_URL=https://french-listening-backend.onrender.com
```

Then restart Expo **with cache clear**:

```bash
cd frontend
npx expo start -c
```

To switch **back to local dev**, change it to:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

---

## 6. Important notes

### Cold starts (free tier)
Free Render services spin down after 15 minutes of inactivity. First request after cold start takes 30–60 seconds.

### SQLite is ephemeral
The database resets on each deploy. For persistent storage, upgrade to Render's PostgreSQL.

### FFmpeg (optional)
FFmpeg is **not required**. The backend gracefully falls back to serving the full audio file when ffmpeg is unavailable. Audio segment extraction (per-question / per-sentence clips) only works when ffmpeg is present.

If you need ffmpeg, deploy via **Docker** instead of Render's native Python runtime — the Python runtime has a read-only filesystem that prevents `apt-get install`.

---

## 7. Test checklist

- [ ] `curl /health` returns `{"status": "ok"}`
- [ ] `curl /api/health` shows FFmpeg + API keys as OK
- [ ] Upload audio from iPhone app → segment generates sentences
- [ ] Turn off computer → iPhone app still calls backend successfully
- [ ] Vocabulary review works
