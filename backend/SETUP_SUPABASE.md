# Supabase PostgreSQL Setup

This project currently uses a local SQLite database (`backend/french_trainer.db`).
To persist data across Render deploys, follow these steps to migrate to Supabase PostgreSQL.

---

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and sign in (GitHub auth works).
2. Click **New project**.
3. Fill in:
   - **Name**: `french-listening-trainer` (or whatever you like)
   - **Database Password**: generate a strong password and save it somewhere safe
   - **Region**: pick the one closest to your Render region (Render's Oregon = US West)
   - **Pricing Plan**: Free tier is fine to start
4. Click **Create new project**.  It takes ~2 minutes to provision.

---

## 2. Get the PostgreSQL connection string

1. In the Supabase dashboard, go to your project.
2. In the left sidebar, click **Settings** (gear icon at the bottom).
3. Click **Database** in the settings submenu.
4. Scroll down to **Connection string**.
5. Select the **URI** tab.
6. Copy the connection string.  It looks like:

   ```
   postgresql://postgres.[project-ref]:[your-password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

   > **Important**: Use port **5432** (session mode), not 6543 (transaction mode).
   > Transaction mode uses PgBouncer, which blocks prepared statements that SQLAlchemy needs.

7. Replace `[your-password]` with the password you set when creating the project.

---

## 3. Test the connection locally

```bash
cd backend

# Set the URL (use your actual connection string)
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Run the migration script — it reads your local SQLite and writes to Supabase
python migrate_to_postgres.py
```

You should see output like:

```
Source:      /.../backend/french_trainer.db
Destination: aws-0-us-west-1.pooler.supabase.com:5432/postgres

Tables ensured on PostgreSQL.
  listening_sessions: 6 rows migrated
  question_segments: 6 rows migrated
  sentence_segments: 66 rows migrated
  vocabulary_items: 9 rows migrated
  review_logs: 0 rows — skipped
Sequences reset to match migrated IDs.

Verification — row count comparison:
  Table                      SQLite  PostgreSQL
  ------------------------- -------- ----------
  listening_sessions              6          6  OK
  ...
```

---

## 4. Set DATABASE_URL in Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Open the **french-listening-trainer** web service.
3. Click **Environment** in the left sidebar.
4. Add a new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: your full Supabase connection string (same one from step 2)
5. Click **Save Changes**.  Render will redeploy the service automatically.
6. Check the deploy logs — you should see `[OK] Database initialized.` on startup.

The `DATABASE_URL` env var will be picked up by `backend/database.py`, and all
future requests will use Supabase PostgreSQL instead of the local SQLite file.

---

## 5. Verify on production

```bash
curl https://french-listening-trainer.onrender.com/api/health
```

Confirm `"status": "ok"`.  Then check that your existing sessions and vocabulary
data are visible in the frontend at the production URL.

---

## Notes

- Your local `backend/french_trainer.db` is **never deleted** — it stays as your
  local development database.  Local dev still defaults to SQLite when
  `DATABASE_URL` is not set.
- If you ever need to re-migrate from local, just run `migrate_to_postgres.py`
  again.  It will **fail on duplicate IDs** if rows already exist, which is expected.
- The Supabase free tier includes 500 MB of database storage, which is more than
  enough for this project.
