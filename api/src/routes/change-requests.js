import { Router } from 'express'
import sql from '../db/client.js'
import { requireAnyRole, requireAgencyOrAdmin } from '../middleware/auth.js'
import { validate } from '../validation/schemas.js'
import { z } from 'zod'

const router = Router()

const ALLOWED_FIELDS = ['artist_name', 'photo_url', 'contact_email', 'phone', 'platforms']

const changeRequestSchema = z.object({
  fields: z.record(z.any()).refine(
    obj => Object.keys(obj).length > 0 && Object.keys(obj).every(k => ALLOWED_FIELDS.includes(k)),
    'Ungültige Felder'
  )
})

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().optional()
})

// GET /api/v1/change-requests
router.get('/', requireAnyRole, async (req, res) => {
  try {
    const { role } = req.user
    let rows

    if (role === 'creator') {
      rows = await sql`
        SELECT cr.*, c.artist_name, c.real_name
        FROM change_requests cr
        JOIN creators c ON c.id = cr.creator_id
        WHERE cr.creator_id = ${req.user.creator_id}
          AND cr.deleted_at IS NULL
        ORDER BY cr.requested_at DESC
      `
    } else if (role === 'agency') {
      rows = await sql`
        SELECT cr.*, c.artist_name, c.real_name
        FROM change_requests cr
        JOIN creators c ON c.id = cr.creator_id
        WHERE cr.agency_id = ${req.user.agency_id}
          AND cr.deleted_at IS NULL
        ORDER BY cr.requested_at DESC
      `
    } else {
      // admin
      rows = await sql`
        SELECT cr.*, c.artist_name, c.real_name, a.name AS agency_name
        FROM change_requests cr
        JOIN creators c ON c.id = cr.creator_id
        JOIN agencies a ON a.id = cr.agency_id
        WHERE cr.deleted_at IS NULL
        ORDER BY cr.requested_at DESC
      `
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/v1/change-requests
router.post('/', requireAnyRole, validate(changeRequestSchema), async (req, res) => {
  try {
    const { role, creator_id } = req.user

    if (role !== 'creator') {
      return res.status(403).json({ error: 'Nur Creator können Änderungsanfragen stellen' })
    }

    if (!creator_id) {
      return res.status(400).json({ error: 'Kein Creator verknüpft' })
    }

    // Fetch creator row to get agency_id
    const [creator] = await sql`
      SELECT id, agency_id FROM creators WHERE id = ${creator_id} AND deleted_at IS NULL
    `
    if (!creator) {
      return res.status(404).json({ error: 'Creator nicht gefunden' })
    }

    // Check for existing pending request
    const [existing] = await sql`
      SELECT id FROM change_requests
      WHERE creator_id = ${creator_id}
        AND status = 'pending'
        AND deleted_at IS NULL
    `
    if (existing) {
      return res.status(409).json({ error: 'Es gibt bereits eine offene Änderungsanfrage' })
    }

    const [newRequest] = await sql`
      INSERT INTO change_requests (creator_id, agency_id, fields)
      VALUES (${creator_id}, ${creator.agency_id}, ${JSON.stringify(req.body.fields)})
      RETURNING *
    `

    // TODO: Telegram-Benachrichtigung wenn Bot verbunden ist

    res.status(201).json(newRequest)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/v1/change-requests/:id
router.patch('/:id', requireAgencyOrAdmin, validate(reviewSchema), async (req, res) => {
  try {
    const { role, agency_id, id: userId } = req.user
    const { id } = req.params
    const { status, note } = req.body

    let existing
    if (role === 'agency') {
      ;[existing] = await sql`
        SELECT * FROM change_requests
        WHERE id = ${id}
          AND agency_id = ${agency_id}
          AND status = 'pending'
          AND deleted_at IS NULL
      `
    } else {
      // admin
      ;[existing] = await sql`
        SELECT * FROM change_requests
        WHERE id = ${id}
          AND status = 'pending'
          AND deleted_at IS NULL
      `
    }

    if (!existing) {
      return res.status(404).json({ error: 'Änderungsanfrage nicht gefunden' })
    }

    if (status === 'approved') {
      const f = existing.fields

      if ('artist_name' in f)   await sql`UPDATE creators SET artist_name   = ${f.artist_name.new}   WHERE id = ${existing.creator_id}`
      if ('photo_url' in f)     await sql`UPDATE creators SET photo_url     = ${f.photo_url.new}     WHERE id = ${existing.creator_id}`
      if ('contact_email' in f) await sql`UPDATE creators SET contact_email = ${f.contact_email.new} WHERE id = ${existing.creator_id}`
      if ('phone' in f)         await sql`UPDATE creators SET phone         = ${f.phone.new}         WHERE id = ${existing.creator_id}`
      if ('platforms' in f)     await sql`UPDATE creators SET platforms     = ${f.platforms.new}     WHERE id = ${existing.creator_id}`
    }

    const [updated] = await sql`
      UPDATE change_requests
      SET status      = ${status},
          note        = ${note ?? null},
          reviewed_at = now(),
          reviewed_by = ${userId}
      WHERE id = ${id}
      RETURNING *
    `

    // TODO: Creator per Telegram benachrichtigen

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
