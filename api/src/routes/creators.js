import { Router } from 'express'
import bcrypt from 'bcrypt'
import sql from '../db/client.js'
import { requireAdmin, requireAgencyOrAdmin, requireAnyRole } from '../middleware/auth.js'
import { validate, creatorSchema, creatorUpdateSchema } from '../validation/schemas.js'

const router = Router()

// Felder die Creator-Rolle NICHT sehen darf (DSGVO)
const CREATOR_SAFE_FIELDS = sql`id, agency_id, artist_name, photo_url, platforms, active, created_at`
const ADMIN_FIELDS = sql`id, agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, telegram_chat_id, notes, active, created_at`

// GET /api/v1/creators/me — Creator: eigenes Profil (gefiltert)
router.get('/me', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') {
    return res.status(403).json({ error: 'Nur für Creator' })
  }
  try {
    const [creator] = await sql`
      SELECT id, agency_id, artist_name, photo_url, contact_email, phone, platforms, active, created_at
      FROM creators WHERE id = ${req.user.creator_id} AND deleted_at IS NULL
    `
    if (!creator) return res.status(404).json({ error: 'Creator nicht gefunden' })
    res.json(creator)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/creators/me/photo — Creator: eigenes Profilfoto setzen (kein Approval nötig)
router.patch('/me/photo', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Nur für Creator' })
  if (!req.user.creator_id) return res.status(400).json({ error: 'Kein Creator verknüpft' })
  const { photo_url } = req.body
  if (!photo_url) return res.status(400).json({ error: 'Foto fehlt' })
  if (photo_url.length > 800000) return res.status(400).json({ error: 'Foto zu groß (max ~600KB)' })
  try {
    await sql`UPDATE creators SET photo_url = ${photo_url} WHERE id = ${req.user.creator_id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/creators — Admin: alle; Agency: eigene
router.get('/', requireAgencyOrAdmin, async (req, res) => {
  try {
    const creators = req.user.role === 'admin'
      ? await sql`SELECT id, agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, telegram_chat_id, active, created_at FROM creators WHERE deleted_at IS NULL ORDER BY real_name`
      : await sql`SELECT id, agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, telegram_chat_id, active, created_at FROM creators WHERE agency_id = ${req.user.agency_id} AND deleted_at IS NULL ORDER BY real_name`
    res.json(creators)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/creators — Atomare Transaktion: Creator + User
router.post('/', requireAgencyOrAdmin, validate(creatorSchema), async (req, res) => {
  const { login_email, login_password, agency_id: bodyAgencyId, ...creatorData } = req.body
  // Agentur: agency_id kommt aus JWT, nicht aus Body
  const agencyId = req.user.role === 'agency' ? req.user.agency_id : bodyAgencyId

  try {
    const result = await sql.begin(async sql => {
      const birthday = creatorData.birthday || null
      const [creator] = await sql`
        INSERT INTO creators (agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, notes)
        VALUES (${agencyId}, ${creatorData.real_name}, ${creatorData.artist_name || null}, ${creatorData.photo_url || null}, ${creatorData.contact_email || null}, ${creatorData.phone || null}, ${birthday}, ${creatorData.platforms}, ${creatorData.notes || null})
        RETURNING id, agency_id, real_name, artist_name, platforms, active, created_at
      `
      const hash = await bcrypt.hash(login_password, 12)
      await sql`
        INSERT INTO users (email, password_hash, role, agency_id, creator_id)
        VALUES (${login_email}, ${hash}, 'creator', ${agencyId}, ${creator.id})
      `
      return creator
    })
    res.status(201).json(result)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vergeben' })
    console.error('Creator create error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/creators/:id — Vollprofil für Admin/Agency (inkl. notes)
router.get('/:id', requireAgencyOrAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const [creator] = req.user.role === 'admin'
      ? await sql`SELECT id, agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, telegram_chat_id, notes, active, created_at FROM creators WHERE id = ${id} AND deleted_at IS NULL`
      : await sql`SELECT id, agency_id, real_name, artist_name, photo_url, contact_email, phone, birthday, platforms, telegram_chat_id, notes, active, created_at FROM creators WHERE id = ${id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`

    if (!creator) return res.status(404).json({ error: 'Creator nicht gefunden' })
    res.json(creator)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/creators/:id
router.patch('/:id', requireAgencyOrAdmin, validate(creatorUpdateSchema), async (req, res) => {
  try {
    const id = req.params.id
    const f = req.body
    const query = req.user.role === 'admin'
      ? sql`UPDATE creators SET
          real_name        = COALESCE(${f.real_name ?? null}, real_name),
          artist_name      = COALESCE(${f.artist_name ?? null}, artist_name),
          photo_url        = COALESCE(${f.photo_url ?? null}, photo_url),
          contact_email    = COALESCE(${f.contact_email ?? null}, contact_email),
          phone            = COALESCE(${f.phone ?? null}, phone),
          birthday         = COALESCE(${f.birthday ?? null}, birthday),
          platforms        = COALESCE(${f.platforms ?? null}, platforms),
          notes            = COALESCE(${f.notes ?? null}, notes),
          telegram_chat_id = COALESCE(${f.telegram_chat_id ?? null}, telegram_chat_id),
          active           = COALESCE(${f.active ?? null}, active)
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id, real_name, artist_name, platforms, active`
      : sql`UPDATE creators SET
          real_name        = COALESCE(${f.real_name ?? null}, real_name),
          artist_name      = COALESCE(${f.artist_name ?? null}, artist_name),
          photo_url        = COALESCE(${f.photo_url ?? null}, photo_url),
          contact_email    = COALESCE(${f.contact_email ?? null}, contact_email),
          phone            = COALESCE(${f.phone ?? null}, phone),
          birthday         = COALESCE(${f.birthday ?? null}, birthday),
          platforms        = COALESCE(${f.platforms ?? null}, platforms),
          notes            = COALESCE(${f.notes ?? null}, notes),
          active           = COALESCE(${f.active ?? null}, active)
        WHERE id = ${id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL
        RETURNING id, real_name, artist_name, platforms, active`

    const [creator] = await query
    if (!creator) return res.status(404).json({ error: 'Creator nicht gefunden' })
    res.json(creator)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/creators/:id — Soft delete, Admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await sql`UPDATE creators SET deleted_at = now() WHERE id = ${req.params.id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
