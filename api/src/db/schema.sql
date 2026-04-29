-- ============================================================
-- CreatorFlow — Datenbankschema v3.0
-- Region: eu-central-1 (Frankfurt) — DSGVO-konform
--
-- WICHTIG: Dieses Schema auf einer leeren Neon-DB ausführen.
-- Alle Änderungen hier dokumentieren und in CLAUDE.md nachtragen.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Agencies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  -- Kontakt
  contact_person   TEXT,
  email            TEXT UNIQUE,
  phone            TEXT,
  website          TEXT,
  -- Adresse
  address_street   TEXT,
  address_city     TEXT,
  address_zip      TEXT,
  address_country  TEXT DEFAULT 'DE',
  -- Intern
  notes            TEXT,
  -- Zahlungssystem (Phase 3)
  stripe_customer_id TEXT,
  plan             TEXT DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  plan_expires_at  TIMESTAMPTZ,
  -- Status
  active           BOOLEAN DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── Creators ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID REFERENCES agencies(id),
  -- Namen
  real_name         TEXT NOT NULL,
  artist_name       TEXT,
  -- Profil
  photo_url         TEXT,
  contact_email     TEXT,
  phone             TEXT,
  birthday          DATE,
  -- Plattformen
  platforms         TEXT[] DEFAULT '{}',
  -- Telegram (nullable, partieller Unique-Index unten)
  telegram_chat_id  BIGINT,
  -- Intern (DSGVO: NICHT an Creator-Rolle zurückgeben)
  notes             TEXT,
  -- Status
  active            BOOLEAN DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Partieller Index: Telegram-ID eindeutig nur unter aktiven Einträgen
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_telegram_unique
  ON creators(telegram_chat_id)
  WHERE deleted_at IS NULL AND telegram_chat_id IS NOT NULL;

-- ── Jobs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID REFERENCES creators(id),
  agency_id         UUID REFERENCES agencies(id),
  week_number       INT NOT NULL,
  year              INT NOT NULL,
  platform          TEXT NOT NULL CHECK (platform IN ('IG','TK','OF','FL','ML','OTHER')),
  content_type      TEXT DEFAULT 'clip' CHECK (content_type IN ('clip','reel','script','other')),
  source_link       TEXT,
  source_message_id BIGINT,
  status            TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','delivered','confirmed','carried')),
  carried_over_from UUID REFERENCES jobs(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  in_progress_at    TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);

-- ── Job Status History ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_status_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID REFERENCES jobs(id),
  old_status        TEXT,
  new_status        TEXT NOT NULL,
  changed_by        UUID,
  changed_by_source TEXT DEFAULT 'bot' CHECK (changed_by_source IN ('bot','api','cron')),
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID REFERENCES jobs(id),
  telegram_message_id   BIGINT,
  telegram_file_id      TEXT,
  received_at           TIMESTAMPTZ DEFAULT now()
);

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID REFERENCES agencies(id),
  creator_id      UUID REFERENCES creators(id),
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'creator' CHECK (role IN ('creator','agency','admin')),
  last_login      TIMESTAMPTZ,
  failed_attempts INT DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Partieller Index: E-Mail eindeutig nur unter aktiven Usern
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE deleted_at IS NULL;

-- ── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Content Plans ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID REFERENCES creators(id),
  agency_id         UUID REFERENCES agencies(id),
  week_number       INT NOT NULL,
  year              INT NOT NULL,
  platform          TEXT NOT NULL CHECK (platform IN ('IG','TK','OF','FL','ML','OTHER')),
  title             TEXT,
  description       TEXT,
  status            TEXT DEFAULT 'idea' CHECK (status IN ('idea','planned','filming','done')),
  visible_to_agency BOOLEAN DEFAULT false,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── System Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies(id),
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
CREATE INDEX IF NOT EXISTS idx_jobs_active       ON jobs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_creators_agency   ON creators(agency_id);
CREATE INDEX IF NOT EXISTS idx_logs_created      ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level_source ON logs(created_at DESC, level, source);
CREATE INDEX IF NOT EXISTS idx_status_history    ON job_status_history(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tok ON refresh_tokens(token_hash) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usr ON refresh_tokens(user_id) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_content_plans_creator ON content_plans(creator_id, week_number, year);
CREATE INDEX IF NOT EXISTS idx_content_plans_agency  ON content_plans(agency_id);
