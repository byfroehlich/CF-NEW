-- ============================================================
-- CreatorFlow — Vollständiges Datenbankschema
-- Version 2.0 — Production-ready
-- 
-- WICHTIG: Neon Projekt auf Region eu-central-1 (Frankfurt) anlegen
-- Vor dem Ausführen dieses Schemas sicherstellen dass die
-- richtige Region ausgewählt ist.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Agencies ────────────────────────────────────────────────
-- Jede Agentur ist vollständig isoliert von anderen Agenturen
CREATE TABLE IF NOT EXISTS agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  active      BOOLEAN DEFAULT true,
  deleted_at  TIMESTAMPTZ,        -- Soft delete
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Creators ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID REFERENCES agencies(id),
  name              TEXT NOT NULL,
  telegram_chat_id  BIGINT UNIQUE,   -- nullable für Phase 2 (Web-only)
  platforms         TEXT[] DEFAULT '{}',
  active            BOOLEAN DEFAULT true,
  deleted_at        TIMESTAMPTZ,     -- Soft delete
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Jobs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID REFERENCES creators(id),
  agency_id           UUID REFERENCES agencies(id),
  week_number         INT NOT NULL,
  year                INT NOT NULL,
  platform            TEXT NOT NULL CHECK (platform IN ('IG','TK','OF','FL','ML','OTHER')),
  content_type        TEXT DEFAULT 'clip' CHECK (content_type IN ('clip','reel','script','other')),
  source_link         TEXT,
  source_message_id   BIGINT,           -- Telegram Message ID der Auftragsnachricht
  status              TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','delivered','confirmed','carried')),
  carried_over_from   UUID REFERENCES jobs(id),
  -- Timestamps für jeden Status-Schritt
  created_at          TIMESTAMPTZ DEFAULT now(),
  in_progress_at      TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  -- Soft delete
  deleted_at          TIMESTAMPTZ
);

-- ── Job Status History ───────────────────────────────────────
-- Jede Status-Änderung wird protokolliert
-- Dient als Beweismittel bei Streitigkeiten
CREATE TABLE IF NOT EXISTS job_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID REFERENCES jobs(id),
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID,                -- user_id (nullable bei Bot-Änderungen)
  changed_by_source TEXT DEFAULT 'bot' CHECK (changed_by_source IN ('bot','api','cron')),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID REFERENCES jobs(id),
  telegram_message_id   BIGINT,
  telegram_file_id      TEXT,   -- Nur File ID, niemals eigentliches Video speichern
  received_at           TIMESTAMPTZ DEFAULT now()
);

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID REFERENCES agencies(id),
  creator_id      UUID REFERENCES creators(id),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'creator' CHECK (role IN ('creator','agency','admin')),
  last_login      TIMESTAMPTZ,
  failed_attempts INT DEFAULT 0,
  locked_until    TIMESTAMPTZ,   -- Account-Sperrung nach zu vielen Fehlversuchen
  deleted_at      TIMESTAMPTZ,   -- Soft delete
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── System Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies(id),   -- nullable für System-Events
  level       TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  source      TEXT NOT NULL DEFAULT 'bot' CHECK (source IN ('bot','api','cron')),
  event       TEXT NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_week         ON jobs(week_number, year);
CREATE INDEX IF NOT EXISTS idx_jobs_creator      ON jobs(creator_id);
CREATE INDEX IF NOT EXISTS idx_jobs_agency       ON jobs(agency_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status       ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_message      ON jobs(source_message_id);
CREATE INDEX IF NOT EXISTS idx_jobs_creator_week ON jobs(creator_id, week_number, year);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted      ON jobs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_logs_created      ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level        ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_lvl  ON logs(created_at DESC, level);
CREATE INDEX IF NOT EXISTS idx_creators_chat     ON creators(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_creators_agency   ON creators(agency_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens    ON refresh_tokens(token_hash) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_status_history    ON job_status_history(job_id, created_at DESC);

-- ── Seed: Default Agency ────────────────────────────────────
INSERT INTO agencies (name, email)
VALUES ('Standard Agentur', 'agentur@creatorflow.app')
ON CONFLICT DO NOTHING;

-- Creatorin wird nach /start des Bots mit telegram_chat_id verknüpft:
-- UPDATE creators SET telegram_chat_id = <CHAT_ID> WHERE name = 'Creatorin';
INSERT INTO creators (agency_id, name, platforms)
SELECT id, 'Creatorin', ARRAY['IG','TK','OF','FL','ML']
FROM agencies WHERE email = 'agentur@creatorflow.app'
ON CONFLICT DO NOTHING;
