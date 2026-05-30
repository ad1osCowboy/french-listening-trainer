# French Listening Trainer

法语听力错题精听和跟读训练 App — MVP v0.1.0

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo SDK 52 |
| Backend | FastAPI (Python 3.10+) |
| Database | SQLite (via SQLAlchemy) |
| Audio | FFmpeg (segment extraction) |
| Transcription | DeepSeek API (OpenAI-compatible) |
| Translation | DeepSeek API (French → English) |

## Project Structure

```
french_listening_trainer/
├── .env                     # API keys (not committed)
├── backend/
│   ├── main.py              # FastAPI entry point + startup diagnostics
│   ├── database.py           # SQLite + SQLAlchemy setup
│   ├── models.py             # ORM models (5 tables)
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── requirements.txt      # Python dependencies
│   ├── routers/
│   │   ├── sessions.py       # CRUD for listening sessions + audio upload
│   │   ├── segments.py       # Question segments + sentence generation
│   │   └── vocabulary.py     # Vocabulary CRUD + review logging
│   └── services/
│       ├── audio_service.py          # FFmpeg audio splitting
│       ├── transcription_service.py  # DeepSeek transcription + translation
│       └── translation_service.py    # Word translation (mock)
├── frontend/
│   ├── App.js                # Root component
│   ├── package.json          # Node dependencies
│   ├── app.json              # Expo config
│   ├── babel.config.js
│   └── src/
│       ├── api/client.js     # API client (configurable base URL)
│       ├── navigation/AppNavigator.js
│       ├── screens/
│       │   ├── HomeScreen.js         # Create/view sessions
│       │   ├── SegmentsScreen.js     # Upload audio, add time segments
│       │   ├── SentencesScreen.js    # Sentence practice + word tap vocab
│       │   ├── PassageScreen.js      # Full segment playback
│       │   └── VocabularyScreen.js   # Vocab review with spaced repetition
│       └── components/
│           └── AudioPlayer.js        # Reusable expo-av player
```

## Data Model

| Table | Key Fields |
|-------|-----------|
| `listening_sessions` | title, audio_file_path, youtube_url |
| `question_segments` | session_id, question_number, start_time, end_time, audio_file_path |
| `sentence_segments` | question_segment_id, sentence_index, french_text, english_translation, audio_file_path, is_mastered |
| `vocabulary_items` | sentence_segment_id, word, translation, context_sentence, is_mastered |
| `review_logs` | vocabulary_item_id, result (remembered/forgot/mastered) |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- FFmpeg (`brew install ffmpeg` on macOS)
- Expo CLI (`npm install -g expo-cli`)

### Environment Setup

1. Create a `.env` file in the project root (the backend loads it automatically):

```bash
# Required: DeepSeek API key for French audio transcription
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

The `.env` file is already in `.gitignore` — it will never be committed.

2. Install backend dependencies:

```bash
cd backend
python3 -m pip install -r requirements.txt
```

### 1. Backend

```bash
cd backend

# Start server
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On startup, the backend runs diagnostics and prints status for:
- Database initialization
- FFmpeg availability (at `/usr/local/bin/ffmpeg`)
- DeepSeek API key configuration
- Uploads directory

If FFmpeg is missing, audio cutting falls back to full audio playback.
If the API key is missing, transcription falls back to mock data.

The API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

Diagnostics endpoints:
- `GET /api/health` — Basic health check with FFmpeg + API key status
- `GET /api/diagnostics` — Full diagnostic report

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android emulator.

### 3. Network Config (Physical Device)

If testing on a physical phone, edit `frontend/src/api/client.js` and change `FALLBACK_HOST` to your machine's LAN IP:

```js
const FALLBACK_HOST = '192.168.x.x';
```

## Features (MVP)

### Home Screen
- Create a new listening session with a title
- View all past sessions
- Long-press to delete a session
- Quick-access FAB button to 生词本

### Segments Screen
- Upload local audio file (mp3, wav, m4a)
- Add question segments with time ranges (format: MM:SS)
- FFmpeg auto-extracts audio clips for each segment
- Play individual segments
- Generate DeepSeek-transcribed sentences for each segment
- Navigate to sentence practice or full-passage mode

### Sentences Screen
- View French transcript + English translation for each sentence
- Play per-sentence audio clips with seekable progress bar
- Speed control: 0.5x, 0.75x, 1x
- Loop control: repeat a single sentence
- Tap any French word → popup with translation + "Add to 生词本"
- Mark sentences as "mastered"

### Passage Screen
- Play the full question segment audio with seekable progress bar
- Speed controls: 0.5x, 0.75x, 1x
- Loop toggle for full passage
- Transcript display with mastered indicators

### Vocabulary Screen
- View all saved words with translations
- Filter: All / Learning / Mastered / Due Today
- Tap to expand → see context sentence + review buttons
- Review logging: Forgot / Got it / Mastered
- Spaced repetition ready (simplified SM-2 to be added)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions/` | Create session |
| GET | `/api/sessions/` | List all sessions |
| GET | `/api/sessions/{id}` | Get session with segments |
| POST | `/api/sessions/{id}/upload-audio` | Upload audio file |
| DELETE | `/api/sessions/{id}` | Delete session |
| POST | `/api/sessions/{id}/segments` | Add question segment |
| GET | `/api/sessions/{id}/segments` | List segments |
| GET | `/api/segments/{id}` | Get segment with sentences |
| DELETE | `/api/segments/{id}` | Delete segment |
| POST | `/api/segments/{id}/generate-sentences` | Generate sentences via DeepSeek |
| GET | `/api/segments/{id}/sentences` | List sentences |
| PUT | `/api/sentences/{id}` | Update sentence (mastered) |
| POST | `/api/vocabulary/` | Add vocabulary word |
| GET | `/api/vocabulary/` | List vocabulary |
| PUT | `/api/vocabulary/{id}` | Update vocabulary |
| DELETE | `/api/vocabulary/{id}` | Delete vocabulary |
| POST | `/api/vocabulary/{id}/review` | Log a review |
| GET | `/api/vocabulary/due/today` | Words due for review |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key for transcription and translation. Get one at [platform.deepseek.com](https://platform.deepseek.com). |
| `DATABASE_URL` | No | Database connection string. Defaults to SQLite at `./french_trainer.db`. Set to a PostgreSQL URL for production. |

## Troubleshooting

### "FFmpeg not found"
Install FFmpeg: `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux).
The backend expects it at `/usr/local/bin/ffmpeg`.

### "DEEPSEEK_API_KEY not set"
Create a `.env` file in the project root with your API key.
Transcription will use mock data until the key is configured.

### "Audio not playing on physical device"
Make sure `FALLBACK_HOST` in `frontend/src/api/client.js` points to your machine's LAN IP, and that your firewall allows port 8000.
