# Malara (ehem. CreatorFlow) — Projektdokumentation

> **WICHTIG:** Alle Architektur-Entscheidungen, Schema-Änderungen, neue Endpoints, neue Komponenten und Rollenrechte müssen hier dokumentiert werden bevor oder unmittelbar nachdem sie implementiert werden. Dieses Dokument ist die einzige Quelle der Wahrheit.

## Git & Deployment

**Render-Deploy-Branch:** `main`  
Render deployt automatisch von `main`. Alle Änderungen direkt auf `main` pushen.

**Arbeitsablauf:**
1. Änderungen lokal entwickeln
2. Commit auf `main`
3. `git push origin main` → Render deployt automatisch

---

## Was ist CreatorFlow?

SaaS-Auftragsmanagement für Content-Agenturen die mit freiberuflichen Creators arbeiten.  
Automatisiert den Workflow von Auftragsvergabe bis Lieferung — primär über Telegram, erweiterbar auf Web.

**Zielgruppe Phase 1:** Ein Admin, ein Creator, eine Agentur.  
**Zielgruppe Phase 2–4:** Mehrere Agenturen, bis 500 Creator, Stripe-Abo-Modell.

---

## Kernprinzipien (nicht verhandelbar)

1. **Telegram bleibt Arbeitskanal** — Bot ist unsichtbarer Layer, kein Workflow-Zwang
2. **Datenisolation** — jede DB-Query prüft `agency_id` oder `creator_id`, kein Cross-Access
3. **Soft Delete überall** — nichts wird hart gelöscht, Audit-Trail für Streitigkeiten
4. **DSGVO-Pflicht** — Neon Frankfurt, Logs nach 90 Tagen, Videos nie selbst speichern
5. **Phase 2 ohne Umbau** — alle Telegram-IDs nullable, Business-Logik framework-agnostisch
6. **Admin-Zugriff ist geloggt** — Admin darf alles lesen/bearbeiten, jede Änderung landet im Audit-Log

---

## Architektur

### 3 unabhängige Services (alle auf Render)

| Service | Technologie | Zweck |
|---|---|---|
| **Bot** | Node.js ESM + Telegraf | Liest Telegram, erkennt Aufträge & Lieferungen |
| **API** | Node.js ESM + Express | REST `/api/v1/`, einziger DB-Zugang |
| **Dashboard** | React + Vite + TailwindCSS | Web-UI für alle Rollen |

### Datenbank
- **Neon PostgreSQL** — Region `eu-central-1` (Frankfurt), DSGVO-konform
- **postgres.js** — kein ORM, direktes SQL, volle Kontrolle
- **Zod** — Validierung auf allen API-Routes, kein unvalidierter Input erreicht die DB

---

## Rollen & Berechtigungen

### Admin
- Einziger User der zu Beginn manuell angelegt wird
- Legt Agenturen und Creator an
- Sieht alle Daten aller Agenturen, filterbar
- Kann alle Daten bearbeiten (wird geloggt)
- Tabs: Aufträge / Creator / Agentur / Kreativ / Statistik / Nutzer / System

### Agentur
- Wird vom Admin angelegt
- Sieht nur eigene Creator und Aufträge
- Kann Creator-Profile ihrer Agentur bearbeiten
- Tabs: Aufträge / Creator / Kreativ / Statistik
- **Kein Zugriff auf:** Nutzer-Tab, System-Tab

### Creator
- Wird vom Admin oder der Agentur angelegt
- Sieht nur eigene Aufträge
- Kann eigene Inhalte planen (Mein Content)
- Tabs: Aufträge / Mein Content

---

## Datenbankschema

### Tabelle: `agencies`

```sql
CREATE TABLE agencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  -- Kontakt
  contact_person  TEXT,
  email           TEXT UNIQUE,
  phone           TEXT,
  website         TEXT,
  -- Adresse
  address_street  TEXT,
  address_city    TEXT,
  address_zip     TEXT,
  address_country TEXT DEFAULT 'DE',
  -- Notizen
  notes           TEXT,
  -- Zahlungssystem (Phase 3 — Felder jetzt schon anlegen)
  stripe_customer_id TEXT,
  plan            TEXT DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  plan_expires_at TIMESTAMPTZ,
  -- Status
  active          BOOLEAN DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `creators`

```sql
CREATE TABLE creators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID REFERENCES agencies(id),
  -- Namen
  real_name         TEXT NOT NULL,       -- Bürgerlicher Name (intern/rechtlich)
  artist_name       TEXT,                -- Künstlername (Anzeigename)
  -- Profil
  photo_url         TEXT,
  contact_email     TEXT,                -- Kontakt-E-Mail (≠ Login-E-Mail)
  phone             TEXT,
  birthday          DATE,                -- Altersnachweis für OF/FL/ML
  -- Plattformen
  platforms         TEXT[] DEFAULT '{}',
  -- Telegram (nullable für Phase 2 Web-only)
  telegram_chat_id  BIGINT,             -- KEIN globales UNIQUE — partieller Index unten
  -- Intern (DSGVO: darf Creator-Rolle NICHT zurückgegeben werden)
  notes             TEXT,
  -- Aktivierungsflow
  activation_status TEXT DEFAULT 'pending' CHECK (activation_status IN ('pending','id_uploaded','ai_checked','active','rejected')),
  rejection_reason  TEXT,
  -- Status
  active            BOOLEAN DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
-- Partieller Unique-Index: erlaubt neue Einträge nach Soft Delete
CREATE UNIQUE INDEX idx_creators_telegram_unique ON creators(telegram_chat_id) WHERE deleted_at IS NULL AND telegram_chat_id IS NOT NULL;
```

### Tabelle: `jobs`

```sql
CREATE TABLE jobs (
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
  partner_type      TEXT DEFAULT 'solo' CHECK (partner_type IN ('solo', 'partner')),
  location_tags     TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  in_progress_at    TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);
```

### Tabelle: `job_status_history`

```sql
CREATE TABLE job_status_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID REFERENCES jobs(id),
  old_status        TEXT,
  new_status        TEXT NOT NULL,
  changed_by        UUID,
  changed_by_source TEXT DEFAULT 'bot' CHECK (changed_by_source IN ('bot','api','cron')),
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `deliveries`

```sql
CREATE TABLE deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID REFERENCES jobs(id),
  telegram_message_id BIGINT,
  telegram_file_id    TEXT,
  received_at         TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `users`

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID REFERENCES agencies(id),   -- gesetzt wenn role = 'agency' oder 'creator'
  creator_id      UUID REFERENCES creators(id),   -- gesetzt wenn role = 'creator'
  email           TEXT NOT NULL,                   -- Login-E-Mail, KEIN globales UNIQUE — partieller Index
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'creator' CHECK (role IN ('creator','agency','admin')),
  last_login      TIMESTAMPTZ,
  failed_attempts INT DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
-- Partieller Unique-Index: E-Mail eindeutig nur unter aktiven Usern
CREATE UNIQUE INDEX idx_users_email_unique ON users(email) WHERE deleted_at IS NULL;
```

### Tabelle: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked = false;
```

### Tabelle: `content_plans`

```sql
CREATE TABLE content_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         UUID REFERENCES creators(id),
  agency_id          UUID REFERENCES agencies(id),
  week_number        INT,
  year               INT,
  platform           TEXT NOT NULL CHECK (platform IN ('IG','TK','OF','FL','ML','OTHER')),
  title              TEXT,
  description        TEXT,
  source_link        TEXT,
  status             TEXT DEFAULT 'idea' CHECK (status IN ('idea','planned','filming','geschnitten','done')),
  visible_to_agency  BOOLEAN DEFAULT false,
  partner_type       TEXT DEFAULT 'solo' CHECK (partner_type IN ('solo','partner')),
  carried_over_from  UUID REFERENCES content_plans(id),
  pushed_to_week     INT,
  pushed_to_year     INT,
  account_id         UUID REFERENCES creator_accounts(id),
  is_top_video       BOOLEAN DEFAULT false,
  location_tags      TEXT[] DEFAULT '{}',
  post_date          DATE,
  post_time          TIME,
  posted_at          TIMESTAMPTZ,
  requisiten         TEXT,
  kleidung           TEXT,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `creator_accounts`

```sql
CREATE TABLE IF NOT EXISTS creator_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID REFERENCES creators(id),
  name        TEXT NOT NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `creator_photos`

```sql
CREATE TABLE creator_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID REFERENCES creators(id),
  url         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('profile','role','id_document')),
  label       TEXT,
  sort_order  INT DEFAULT 0,
  uploaded_by UUID REFERENCES users(id),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `change_requests`

```sql
CREATE TABLE change_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID REFERENCES creators(id),
  agency_id    UUID REFERENCES agencies(id),
  field        TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  UUID REFERENCES users(id),
  review_note  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  reviewed_at  TIMESTAMPTZ
);
```

### Tabelle: `system_settings`

```sql
CREATE TABLE system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelle: `logs`

```sql
CREATE TABLE logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID REFERENCES agencies(id),
  level      TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  source     TEXT NOT NULL DEFAULT 'bot' CHECK (source IN ('bot','api','cron')),
  event      TEXT NOT NULL,
  message    TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## API Endpoints

### Auth (`/api/v1/auth`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| POST | `/login` | alle | Login, gibt access_token + refresh_token |
| POST | `/refresh` | alle | Token erneuern |
| POST | `/logout` | alle | Refresh Token revoken |

### Agencies (`/api/v1/agencies`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin | Alle Agenturen |
| POST | `/` | admin | Neue Agentur anlegen |
| GET | `/:id` | admin, agency (eigene) | Agentur-Detail |
| PATCH | `/:id` | admin, agency (eigene) | Agentur bearbeiten |
| DELETE | `/:id` | admin | Soft delete |

### Creators (`/api/v1/creators`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin (alle), agency (eigene), creator (selbe Agentur, sichere Felder) | Creator-Liste |
| POST | `/` | admin, agency | Neuen Creator + User anlegen (Transaktion) |
| GET | `/me` | creator | Eigenes Profil (gefiltert: keine notes/interne Felder) |
| GET | `/:id` | admin, agency (eigene) | Creator-Detail inkl. notes |
| PATCH | `/:id` | admin, agency (eigene) | Creator bearbeiten |
| DELETE | `/:id` | admin | Soft delete |

### Jobs (`/api/v1/jobs`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin (alle), agency (eigene), creator (eigene) | Jobs nach KW/Plattform |
| POST | `/` | admin, agency | Neuen Job anlegen |
| PATCH | `/:id/status` | admin, agency, bot | Status ändern |
| PATCH | `/:id` | creator | Job-Metadaten bearbeiten (partner_type, location_tags) |
| DELETE | `/:id` | admin | Soft delete |
| GET | `/summary` | admin, agency, creator | Wochenstatistik |
| GET | `/stats` | admin, agency, creator | Zeitraum-Statistik |
| GET | `/combined` | creator | Kombinierte Liste: Jobs + content_plans |

### Content Plans (`/api/v1/content-plans`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | creator (eigene), agency (eigene), admin (alle) | Pläne |
| POST | `/` | creator, agency, admin | Neuen Plan anlegen |
| PATCH | `/:id` | creator (eigene), agency, admin | Plan bearbeiten inkl. account_id-Move |
| DELETE | `/:id` | creator (eigene), agency, admin | Soft delete |

**account_id-Move:** Creator kann Plan per PATCH zu anderem Account derselben Agentur verschieben.

### Creator Accounts (`/api/v1/creator-accounts`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | creator | Eigene Accounts |
| POST | `/` | creator | Neuen Account anlegen |
| PATCH | `/:id` | creator | Account umbenennen |
| DELETE | `/:id` | creator | Account soft-löschen |

### Creator Photos (`/api/v1/creators/:id/photos`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin, agency (eigene) | Fotos eines Creators |
| POST | `/` | admin, agency | Foto-Eintrag anlegen |
| PATCH | `/:photoId` | admin, agency | Label / sort_order ändern |
| DELETE | `/:photoId` | admin, agency | Foto soft-löschen |

### Change Requests (`/api/v1/change-requests`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin (alle), agency (eigene), creator (eigene) | Änderungsanfragen |
| POST | `/` | creator | Neue Anfrage stellen |
| PATCH | `/:id` | admin, agency | Genehmigen oder ablehnen |

### Upload (`/api/v1/upload`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| POST | `/` | admin, agency | Datei zu Cloudflare R2 hochladen |

### System (`/api/v1/system`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/settings` | admin | Alle System-Einstellungen |
| PATCH | `/settings/:key` | admin | Einstellung ändern |

### Logs (`/api/v1/logs`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin | System-Logs |
| GET | `/summary` | admin | 24h/1h Zusammenfassung |

---

## Dashboard — Tabs pro Rolle

### Admin-Dashboard
- **Aufträge** — alle Agenturen, Filter: KW / Plattform / Agentur / Creator
- **Creator** — Creator-Kartei mit Aktivierungsflow + Foto-Upload
- **Agentur** — Agentur-Verwaltung
- **Statistik** — Platzhalter
- **Nutzer** — Platzhalter
- **System** — Logs, System-Einstellungen, Status-Karten

### Agentur-Dashboard
- **Aufträge** — nur eigene Creator
- **Creator** — eigene Creator-Kartei; Aktivierungsflow; Change-Request-Banner
- **Kreativ** — freigegebene Pläne (`visible_to_agency=true`)
- **Statistik** — Platzhalter

### Creator-Dashboard
- **Aufträge** — Sub-Tabs: Aufträge / Kombiniert; Filter: Plattform / Art / Status / Location
- **Mein Content** — Sub-Tabs: Wochenplan / Ideen / Top-Videos; Account-Selector; Posting-Kalender (drag & drop); Filter: Plattform / Art / Status / Location
- **Kalender** — Wochenansicht mit post_date/post_time; Account-Badge auf Karten; Drag & Drop
- **Profil** — eigenes Profil, Foto-Upload
- **Statistik** — Zeitraum-Karten, Plattform-Balken, Monatsverlauf

---

## Design-System

### Logo (alle Rollen)
- **MalaraLogo** Komponente (`dashboard/src/components/MalaraLogo.jsx`)
- Zwei sich kreuzende Loops (M-Form), Gradient violet→pink
- Props: `height`, `variant` ('color'|'white'), `iconOnly`
- gradient x2 passt sich dynamisch an viewBox-Breite an

### Header-Farben
| Rolle | Hintergrund |
|---|---|
| Creator | `bg-gradient-to-r from-violet-600 to-pink-500` |
| Admin | `bg-gradient-to-r from-violet-950 to-fuchsia-950` |
| Agentur | `bg-gradient-to-r from-violet-950 to-fuchsia-950` |

### Farb-Tokens (Tailwind)

| Zweck | Klasse |
|---|---|
| Aktiver Tab / Button | `bg-indigo-600 text-white` |
| Offen / Rot | `text-red-500` |
| Erledigt / Grün | `text-green-500` |
| In Arbeit / Orange | `text-orange-500` |
| Überträge / Gelb | `text-yellow-500` |
| Hintergrund | `bg-gray-50` |
| Karte | `bg-white rounded-xl border border-gray-200` |

---

## Sicherheit

- JWT Access Token: 24h Laufzeit
- Refresh Token: 30 Tage, SHA-256 gehasht in DB
- Passwort-Hashing: bcrypt 12 Runden
- Account-Sperre: nach 10 Fehlversuchen, 30 Minuten
- Rate Limiting: 100 req/min allgemein, 10/15min für Login
- Helmet.js, CORS nur `ALLOWED_ORIGIN`
- Erster Admin: `POST /api/v1/auth/setup` mit `X-Setup-Key`

## Rollenbasiertes Routing

- `admin` → `/admin`
- `agency` → `/agentur`
- `creator` → `/creator`
- JWT in `localStorage`, bei 401 automatisch refresh

## postgres.js Transaktions-Syntax

```js
await sql.begin(async sql => {
  const [creator] = await sql`INSERT INTO creators (...) VALUES (...) RETURNING id`
  await sql`INSERT INTO users (..., creator_id) VALUES (..., ${creator.id})`
})
```

## Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Node.js ESM überall | kein CJS/ESM-Mix |
| postgres.js statt ORM | direktes SQL, volle Query-Kontrolle |
| postgres.js `prepare: false` | kein Schema-Cache-Problem nach ALTER TABLE |
| Zod auf allen Routes | kein unvalidierter Input erreicht die DB |
| Soft Delete | regulatorisch + Audit-Trail |
| Neon Frankfurt | DSGVO |
| TanStack Query v5 | `invalidateQueries({ queryKey: [...] })` |

---

*Zuletzt aktualisiert: 2026-05-14 — main ist Deploy-Branch; Malara-Rebrand; Status-Filter, Uhrzeit, Account im Kalender*  
*Alle Änderungen müssen hier dokumentiert werden.*
