import { Router } from 'express'
import bcrypt from 'bcrypt'
import sql from '../db/client.js'
import { requireAdmin, requireAgencyOrAdmin } from '../middleware/auth.js'
import { validate, agencySchema, agencyUpdateSchema } from '../validation/schemas.js'

const router = Router()

// GET /api/v1/agencies — Admin: alle; Agency: nur eigene
router.get('/', requireAgencyOrAdmin, async (req, res) => {
  try {
    const agencies = req.user.role === 'admin'
      ? await sql`SELECT id, name, contact_person, email, phone, website, address_street, address_city, address_zip, address_country, active, plan, created_at FROM agencies WHERE deleted_at IS NULL ORDER BY name`
      : await sql`SELECT id, name, contact_person, email, phone, website, address_street, address_city, address_zip, address_country, active, plan, created_at FROM agencies WHERE id = ${req.user.agency_id} AND deleted_at IS NULL`
    res.json(agencies)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/agencies — Admin only, legt Agentur + User-Account an
router.post('/', requireAdmin, validate(agencySchema), async (req, res) => {
  const { login_email, login_password, ...agencyData } = req.body
  try {
    const result = await sql.begin(async sql => {
      const [agency] = await sql`
        INSERT INTO agencies (name, contact_person, email, phone, website, address_street, address_city, address_zip, address_country, notes)
        VALUES (${agencyData.name}, ${agencyData.contact_person || null}, ${agencyData.email || null}, ${agencyData.phone || null}, ${agencyData.website || null}, ${agencyData.address_street || null}, ${agencyData.address_city || null}, ${agencyData.address_zip || null}, ${agencyData.address_country || 'DE'}, ${agencyData.notes || null})
        RETURNING id, name, email, active, created_at
      `
      const hash = await bcrypt.hash(login_password, 12)
      await sql`
        INSERT INTO users (email, password_hash, role, agency_id)
        VALUES (${login_email}, ${hash}, 'agency', ${agency.id})
      `
      return agency
    })
    res.status(201).json(result)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vergeben' })
    console.error('Agency create error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/agencies/:id — inkl. zugehöriger Creator-Liste
router.get('/:id', requireAgencyOrAdmin, async (req, res) => {
  try {
    const id = req.params.id
    if (req.user.role === 'agency' && req.user.agency_id !== id) {
      return res.status(403).json({ error: 'Kein Zugriff' })
    }
    const [agency] = await sql`
      SELECT id, name, contact_person, email, phone, website, address_street, address_city, address_zip, address_country, notes, active, plan, plan_expires_at, created_at
      FROM agencies WHERE id = ${id} AND deleted_at IS NULL
    `
    if (!agency) return res.status(404).json({ error: 'Agentur nicht gefunden' })

    const creators = await sql`
      SELECT id, real_name, artist_name, photo_url, platforms, active, created_at
      FROM creators WHERE agency_id = ${id} AND deleted_at IS NULL ORDER BY real_name
    `
    res.json({ ...agency, creators })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/agencies/:id
router.patch('/:id', requireAgencyOrAdmin, validate(agencyUpdateSchema), async (req, res) => {
  try {
    const id = req.params.id
    if (req.user.role === 'agency' && req.user.agency_id !== id) {
      return res.status(403).json({ error: 'Kein Zugriff' })
    }
    const fields = req.body
    const [agency] = await sql`
      UPDATE agencies SET
        name             = COALESCE(${fields.name ?? null}, name),
        contact_person   = COALESCE(${fields.contact_person ?? null}, contact_person),
        email            = COALESCE(${fields.email ?? null}, email),
        phone            = COALESCE(${fields.phone ?? null}, phone),
        website          = COALESCE(${fields.website ?? null}, website),
        address_street   = COALESCE(${fields.address_street ?? null}, address_street),
        address_city     = COALESCE(${fields.address_city ?? null}, address_city),
        address_zip      = COALESCE(${fields.address_zip ?? null}, address_zip),
        address_country  = COALESCE(${fields.address_country ?? null}, address_country),
        notes            = COALESCE(${fields.notes ?? null}, notes),
        active           = COALESCE(${fields.active ?? null}, active)
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id, name, email, active
    `
    if (!agency) return res.status(404).json({ error: 'Agentur nicht gefunden' })
    res.json(agency)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/agencies/:id — Soft delete, Admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await sql`UPDATE agencies SET deleted_at = now() WHERE id = ${req.params.id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
