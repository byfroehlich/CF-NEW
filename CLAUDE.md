# CreatorFlow — Projektdokumentation

> **WICHTIG:** Alle Architektur-Entscheidungen, Schema-Änderungen, neue Endpoints, neue Komponenten und Rollenrechte müssen hier dokumentiert werden bevor oder unmittelbar nachdem sie implementiert werden. Dieses Dokument ist die einzige Quelle der Wahrheit.

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
  week_number        INT NOT NULL,
  year               INT NOT NULL,
  platform           TEXT NOT NULL CHECK (platform IN ('IG','TK','OF','FL','ML','OTHER')),
  title              TEXT,
  description        TEXT,
  status             TEXT DEFAULT 'idea' CHECK (status IN ('idea','planned','filming','done')),
  visible_to_agency  BOOLEAN DEFAULT false,  -- Creator gibt Plan für Agentur-Kreativ-Tab frei
  partner_type       TEXT DEFAULT 'solo' CHECK (partner_type IN ('solo','partner')),
  carried_over_from  UUID REFERENCES content_plans(id),  -- gesetzt wenn Übertrag aus Vorwoche
  pushed_to_week     INT,   -- gesetzt auf Original wenn in nächste Woche geschoben
  pushed_to_year     INT,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);
```

**DB-Migrationen (bereits auf Neon ausgeführt):**
```sql
ALTER TABLE content_plans
  ADD COLUMN IF NOT EXISTS carried_over_from UUID REFERENCES content_plans(id),
  ADD COLUMN IF NOT EXISTS pushed_to_week INT,
  ADD COLUMN IF NOT EXISTS pushed_to_year INT;

ALTER TABLE content_plans
  ADD COLUMN IF NOT EXISTS partner_type TEXT DEFAULT 'solo'
    CHECK (partner_type IN ('solo', 'partner'));
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
| GET | `/` | admin (alle), agency (eigene) | Creator-Liste |
| POST | `/` | admin, agency | Neuen Creator + User anlegen (Transaktion) |
| GET | `/me` | creator | Eigenes Profil (gefiltert: keine notes/interne Felder) |
| GET | `/:id` | admin, agency (eigene) | Creator-Detail inkl. notes |
| PATCH | `/:id` | admin, agency (eigene) | Creator bearbeiten |
| DELETE | `/:id` | admin | Soft delete |

**DSGVO-Pflicht:** `GET /me` und alle Creator-Responses an role=creator dürfen NICHT enthalten: `notes`, `real_name` (nur artist_name zurückgeben), `birthday`, `phone`, `contact_email`. Diese Felder sind interne Agentur-Daten.

### Jobs (`/api/v1/jobs`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin (alle), agency (eigene), creator (eigene) | Jobs nach KW/Plattform |
| POST | `/` | admin, agency | Neuen Job anlegen |
| PATCH | `/:id/status` | admin, agency, bot | Status ändern |
| DELETE | `/:id` | admin | Soft delete |
| GET | `/summary` | admin, agency, creator | Wochenstatistik (creator: nur eigene) |
| GET | `/stats` | admin, agency, creator | Zeitraum-Statistik: Monat/Quartal/Halbjahr/Jahr + Plattform-Verteilung + Monatsverlauf |

### Content Plans (`/api/v1/content-plans`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | creator (eigene), agency (eigene), admin (alle) | Pläne nach KW, Query-Params: week, year, platform |
| POST | `/` | creator, agency, admin | Neuen Plan anlegen |
| PATCH | `/:id` | creator (eigene), agency, admin | Plan bearbeiten (COALESCE-Update) |
| DELETE | `/:id` | creator (eigene), agency, admin | Soft delete |

**Schieben-Logik:** `POST` erstellt Kopie mit `carried_over_from: original.id`; gleichzeitig `PATCH` auf Original setzt `pushed_to_week/year`. Beide Richtungen sichtbar: Original zeigt „→ KW{n}", Kopie zeigt Amber-Badge „↩ Übertrag".

### Logs (`/api/v1/logs`)

| Method | Path | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/` | admin | System-Logs |

---

## Dashboard — Tabs pro Rolle

### Admin-Dashboard
- **Aufträge** — alle Agenturen, Filter: KW / Plattform / Agentur / Creator
- **Creator** — Creator-Kartei, Anlegen-Formular, Bearbeiten
- **Agentur** — Agentur-Verwaltung, Anlegen, Details, zugeordnete Creator
- **Kreativ** — freigegebene Content-Pläne, Filter wie Aufträge
- **Statistik** — alle Agenturen, filterbar nach Agentur / Creator / KW
- **Nutzer** — alle User-Accounts, Rollen, Status
- **System** — Bot-Status, Logs, Heartbeat

### Agentur-Dashboard
- **Aufträge** — nur eigene Creator, Filter: KW / Plattform / Creator
- **Creator** — eigene Creator-Kartei, Anlegen, Bearbeiten
- **Kreativ** — freigegebene Pläne der eigenen Creator
- **Statistik** — nur eigene Agentur

### Creator-Dashboard
- **Aufträge** — nur eigene Jobs, Filter: KW / Plattform
- **Mein Content** — Content-Pläne anlegen/bearbeiten/löschen; Filter: KW / Plattform / Solo-Partner; Stat-Karten (Gesamt/Offen/Erledigt); nummerierte Liste; Checkbox zum Abhaken; Inline-Edit; Schieben → nächste KW mit Übertrag-Badge; Agentur-Sichtbarkeit-Toggle
- **Statistik** — Wochenübersicht (Jobs der aktuellen KW) + Zeitraum-Karten (Monat/Quartal/Halbjahr/Jahr) + Plattform-Balken + Monatsverlauf; aktuell nur Aufträge (Jobs) — Eigener Content fehlt noch (→ TODO)

---

## Creator anlegen — Formular (Admin & Agentur)

Wenn Admin anlegt: Agentur-Dropdown vorhanden (zukunftssicher).  
Wenn Agentur anlegt: `agency_id` automatisch aus JWT, kein Dropdown.

**Felder:**

| Feld | Tabelle.Spalte | Pflicht | Hinweis |
|---|---|---|---|
| Bürgerlicher Name | `creators.real_name` | ja | intern/rechtlich |
| Künstlername | `creators.artist_name` | nein | Anzeigename |
| Foto-URL | `creators.photo_url` | nein | |
| Kontakt-E-Mail | `creators.contact_email` | nein | ≠ Login-E-Mail |
| Telefon | `creators.phone` | nein | |
| Geburtstag | `creators.birthday` | nein | Altersnachweis |
| Plattformen | `creators.platforms[]` | ja | Multi-Toggle |
| Interne Notizen | `creators.notes` | nein | nur Agentur/Admin |
| Agentur | `creators.agency_id` | ja | Dropdown (nur Admin) |
| Login E-Mail | `users.email` | ja | Login-Account |
| Passwort | `users.password_hash` | ja | min. 8 Zeichen |

**Backend:** `POST /api/v1/creators` legt in **einer Transaktion** an:
1. INSERT in `creators`
2. INSERT in `users` (role: 'creator', creator_id: neue ID, agency_id: übernommen)
3. Bei Fehler: vollständiger Rollback

---

## Agentur anlegen — Formular (Admin)

| Feld | Tabelle.Spalte | Pflicht |
|---|---|---|
| Agenturname | `agencies.name` | ja |
| Ansprechpartner | `agencies.contact_person` | nein |
| E-Mail | `agencies.email` | nein |
| Telefon | `agencies.phone` | nein |
| Website | `agencies.website` | nein |
| Straße | `agencies.address_street` | nein |
| Stadt | `agencies.address_city` | nein |
| PLZ | `agencies.address_zip` | nein |
| Land | `agencies.address_country` | nein |
| Notizen | `agencies.notes` | nein |
| Login E-Mail | `users.email` | ja |
| Passwort | `users.password_hash` | ja |

**Backend:** `POST /api/v1/agencies` legt in **einer Transaktion** an:
1. INSERT in `agencies`
2. INSERT in `users` (role: 'agency', agency_id: neue ID)

---

## Design-System

### Grundprinzip
Jede Rolle hat ein **visuell eigenständiges Design**. Creator-UI ist warm und konsumgerecht, Admin-UI ist professionell und informationsdicht. Agentur liegt dazwischen.

---

### Logo / Header-Logo (alle Rollen)
- Rundes/quadratisches Avatar-Icon: **„CF"** in Weiß auf Indigo/Lila Hintergrund
- Daneben: **„CreatorFlow"** fettgedruckt
- Darunter: Rollen-Kontext (siehe je Rolle)
- Rechts im Header: KW-Navigation `< KW 18 / 2026 >` mit Pfeil-Buttons + „Abmelden"-Link

---

### Creator-Dashboard

**Header:**
- Hintergrund: **Gradient von Lila/Violett (links) nach Pink/Magenta (rechts)**
- Logo-Subtitle: Nur die KW, z.B. `KW18`
- Farbe Header-Text: Weiß

**Tabs** (als Pill-Buttons direkt unter dem Header-Bereich, nicht als Leiste):
- `Aufträge` | `Mein Content`
- Aktiver Tab: weiß ausgefüllt, runde Pill-Form
- Inaktiver Tab: transparent mit weißer Schrift

**Statistik-Karten** (3 Stück):
- `Gesamt` — Zahl in Grau
- `Offen` — Zahl in **Rot/Coral**
- `Erledigt` — Zahl in **Grün**
- Karten: weiß, abgerundete Ecken, kein farbiger Balken oben

**Plattform-Filter:**
- Pills: `Alle | IG | TK | OF | FL | ML`
- Aktiv: dunkel ausgefüllt (Indigo/Dunkelgrau)
- Inaktiv: weißer Hintergrund, grauer Rand

**Leer-Zustand:** Rosa Blumen-Emoji + grauer Text „Keine Jobs für KW18"

**Mein Content Tab:**
- Plattform-Filter (Alle / IG / OF …)
- Zweiter Filter: `Alle | 👤 Solo | 👥 Partner`
- Warn-Banner (gelb/amber): „Kein Creator in der Datenbank — zuerst im Admin-Tab einen Creator anlegen."
- Neuer Plan: gestrichelter Rahmen-Button `+ Neuer Content-Plan` in Lila
- Leer-Zustand: 🎬 Emoji + grauer Text

**Hintergrund:** Sehr helles Grau / fast Weiß (`gray-50`)

---

### Admin-Dashboard

**Header:**
- Hintergrund: **Dunkles Navy/Charcoal** (`gray-900` / `#111827`)
- Logo-Subtitle: `ADMIN · Agentur-Übersicht` in gedämpftem Grau
- Farbe Header-Text: Weiß
- „ABMELDEN" als Text-Link rechts oben (Caps, klein)

**Tabs** (horizontale Tab-Leiste, direkt auf weißem/grauem Hintergrund unter Header):
- `Aufträge | Creator | ▶ Kreativ | Statistik | Nutzer | ⚙ System`
- Aktiver Tab: fett, Unterstrich oder dunkle Füllung
- System-Tab hat Zahnrad-Icon `⚙`
- Kreativ-Tab hat Play-Icon `▶`

**Statistik-Karten** (5 Stück, breiter):
- `GESAMT | OFFEN | IN ARBEIT | GELIEFERT | ÜBERTRÄGE`
- Label in Caps, klein, gedämpft
- Dünne farbige Linie **oben** auf der Karte (kein großes Zahl-Farb-Highlight)
- Farben der Linien: Grau / Rot / Orange / Grün / Gelb

**Plattform-Filter:** Identisch zu Creator, aber `Alle` = schwarze Pill

**Leer-Zustand:** Nur Text „Keine Jobs für diese Auswahl." zentriert, grau

**System-Tab:**
- Abschnitt „SYSTEM-STATUS" (Caps-Label)
- Status-Karten (4 Stück nebeneinander): `BOT | FEHLER (1H) | LETZTER JOB | LETZTE LIEFERUNG`
  - Farbiger Punkt rechts oben: Rot = Problem, Grün = OK
- Zusammenfassungs-Karten (3 Stück): `Info (24h)` grün getönt | `Warnungen (24h)` gelb getönt | `Fehler (24h)` rot getönt
- Log-Filter: `Alle Level | Info | Warn | Error` + `Alle Quellen | Bot | Api | Cron`
- Footer: „Automatische Aktualisierung alle 30 Sekunden" grau, zentriert

**Hintergrund:** Helles Grau (`gray-50`)

---

### Agentur-Dashboard

Design analog zu Admin (dunkler Header `bg-gray-900`):
- Header-Subtitle: `AGENTUR · [Agenturname]`
- Tabs: `Aufträge | Creator | Kreativ | Statistik` (kein Nutzer, kein System)
- **Kreativ-Tab:** zeigt `visible_to_agency = true` Pläne der eigenen Creator; Amber-Badge für Überträge (`carried_over_from` gesetzt); „→ KW{n} geschoben" Badge für weitergeschobene Pläne
- Statistik-Karten: wie Admin (5 Stück mit farbigen Linien)

---

### Bottom Navigation Bar (Dev/Test-Hilfe)
Persistente Leiste am unteren Rand — dient zum schnellen Rollen-Wechsel während Entwicklung:
- Buttons: `Admin | Agentur | Creator | 🔓 Einloggen`
- Aktive Rolle: lila/indigo Pill-Button (ausgefüllt)
- Inaktive Rollen: graue Text-Buttons
- **In Production:** diese Leiste entfernen oder nur für Admin sichtbar lassen

---

### Farb-Tokens (Tailwind)

| Zweck | Klasse |
|---|---|
| Creator-Header Gradient | `bg-gradient-to-r from-violet-600 to-pink-500` |
| Admin-Header | `bg-gray-900` |
| Aktiver Tab / Button | `bg-indigo-600 text-white` |
| Offen / Rot | `text-red-500` |
| Erledigt / Grün | `text-green-500` |
| In Arbeit / Orange | `text-orange-500` |
| Überträge / Gelb | `text-yellow-500` |
| Hintergrund | `bg-gray-50` |
| Karte | `bg-white rounded-xl border border-gray-200` |
| Warn-Banner | `bg-amber-50 border border-amber-200 text-amber-800` |
| Gestrichelter Button | `border-2 border-dashed border-indigo-300 text-indigo-500` |

---

## Implementierungsreihenfolge

### Phase 1 — Grundsystem (aktuell)
- [x] DB-Schema Migration (auf Neon ausgeführt, inkl. alle nachträglichen ALTER TABLE)
- [x] API: `POST /api/v1/agencies` (Transaktion)
- [x] API: `POST /api/v1/creators` (Transaktion)
- [x] API: `GET/PATCH /api/v1/agencies/:id`
- [x] API: `GET/PATCH /api/v1/creators/:id`
- [x] API: `GET/POST/PATCH/DELETE /api/v1/content-plans`
- [x] API: `GET /api/v1/jobs/stats` (Zeitraum-Statistik)
- [x] Dashboard: Admin-Login funktionsfähig
- [x] Dashboard: Admin — Agentur-Tab (Liste + Anlegen + Detail)
- [x] Dashboard: Admin — Creator-Tab (Liste + Anlegen-Formular)
- [x] Dashboard: Admin — Nutzer-Tab (Liste)
- [x] Dashboard: Creator-Login funktionsfähig
- [x] Dashboard: Creator — Aufträge-Tab
- [x] Dashboard: Creator — Mein Content-Tab (vollständig inkl. Schieben, Inline-Edit, Solo/Partner)
- [x] Dashboard: Creator — Statistik-Tab (Wochenübersicht + Zeitraum-Karten + Balken)
- [x] Dashboard: Agentur-Login + Agentur-Dashboard (Aufträge / Creator / Kreativ / Statistik)

### Nächste Session (Priorität)
- [ ] **Statistik: Eigener Content** — `GET /api/v1/content-plans/stats` Endpoint + `getContentPlanStats` in api.js + Toggle „Aufträge / Eigener Content" im Creator StatistikTab
- [ ] **PWA** — `vite-plugin-pwa` + Web App Manifest (CF-Icons) + Service Worker (NetworkFirst für offline Jobs/Pläne) + mobile-first Layout-Optimierungen Creator-Dashboard

### Phase 2
- [ ] Agentur-Login + Agentur-Dashboard vollständig (Statistik-Tab ausbauen)
- [ ] Bot-Integration für Creator (Telegram Chat ID verknüpfen)
- [ ] Webhook statt Polling

### Phase 3 — SaaS
- [ ] Stripe Checkout + Webhooks
- [ ] `agencies.stripe_customer_id` + `plan` + `plan_expires_at` befüllen
- [ ] Agentur-Onboarding Flow

---

## Sicherheit

- JWT Access Token: 24h Laufzeit
- Refresh Token: 30 Tage, SHA-256 gehasht in DB
- Passwort-Hashing: bcrypt mit **12 Runden** (14 zu langsam für Render Free Tier — ~3–5s, Timeout-Risiko)
- Account-Sperre: nach 10 Fehlversuchen, 30 Minuten
- Rate Limiting: 100 req/min allgemein, 10/15min für Login
- Helmet.js: Security-Headers inkl. HSTS
- CORS: nur `ALLOWED_ORIGIN` aus ENV
- Alle Admin-Änderungen an fremden Daten: werden in `logs` protokolliert
- Erster Admin-User: via `POST /api/v1/auth/setup` mit `X-Setup-Key` Header (ENV: `SETUP_KEY`). Nach erstem Admin-Anlegen: `SETUP_KEY` aus ENV entfernen.
- Passwort-Reset Phase 1: Admin setzt Passwort via `PATCH /api/v1/users/:id` (admin-only) manuell zurück. Selbstständiger Reset-Flow kommt in Phase 2.

## Rollenbasiertes Routing (Dashboard)

- Nach Login: Redirect basierend auf `role` aus API-Response
  - `admin` → `/admin`
  - `agency` → `/agentur`
  - `creator` → `/creator`
- Geschützte Routen: falsche Rolle → Redirect auf `/login`
- JWT wird in `localStorage` gespeichert, bei 401-Response automatisch refresh versuchen

## Telegram Creator-Verknüpfung (Phase 1: manuell)

Creator wird im Dashboard angelegt (ohne Telegram-ID).  
Verknüpfung Phase 1: Admin setzt `telegram_chat_id` manuell via `PATCH /api/v1/creators/:id`.  
Phase 2: Creator schreibt `/start` im Bot → Bot liest `telegram_chat_id` → verknüpft via Einmal-Code oder E-Mail-Abgleich (noch zu definieren).

## postgres.js Transaktions-Syntax

```js
// Korrekte Syntax für atomare Operationen:
await sql.begin(async sql => {
  const [creator] = await sql`INSERT INTO creators (...) VALUES (...) RETURNING id`
  await sql`INSERT INTO users (..., creator_id) VALUES (..., ${creator.id})`
  // Bei Exception: automatischer Rollback
})
```

---

## Datenschutz (DSGVO)

- Serverstandort: Frankfurt (Neon + Render EU)
- Logs: automatische Löschung nach 90 Tagen (Cron in Bot + API)
- Videos: werden nie gespeichert, nur Telegram File-IDs
- Admin-Zugriff auf Agentur/Creator-Daten: rechtlich sauber als Plattformbetreiber (AVV), technisch geloggt
- Soft Delete: keine Daten werden hart gelöscht
- AVV mit jeder Agentur unterzeichnen vor Go-Live

---

## Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Node.js ESM überall | kein CJS/ESM-Mix |
| postgres.js statt ORM | direktes SQL, volle Query-Kontrolle |
| postgres.js `prepare: false` | verhindert „cached plan must not change result type" nach ALTER TABLE; ohne prepared statements kein Schema-Cache-Problem bei Migrations |
| Zod auf allen Routes | kein unvalidierter Input erreicht die DB |
| Soft Delete | regulatorisch + Audit-Trail |
| Render | bestehender Account, EU-Hosting |
| Neon Frankfurt | DSGVO für sensible Datenkategorie |
| API `/api/v1/` | Breaking Changes ohne Dashboard-Ausfall |
| Transaktion bei Creator/Agentur-Anlegen | atomare Operation, kein inkonsistenter State |
| TanStack Query v5 | `invalidateQueries({ queryKey: [...] })` — NICHT v4-Array-Syntax `invalidateQueries([...])` |

---

## Offene Entscheidungen

- [ ] Foto-Upload: Foto-URL (extern) vs. Direktupload zu Cloudflare R2 (Phase 2)
- [ ] 2FA: TOTP für Admin/Agency (Backlog, vor Phase 3)
- [ ] Webhook vs. Polling: Bot auf Webhook umstellen (vor Phase 2 Go-Live)

---

*Zuletzt aktualisiert: 2026-04-30 — Phase 1 Grundsystem abgeschlossen, Statistik + PWA als nächstes*  
*Alle Änderungen müssen hier dokumentiert werden.*
