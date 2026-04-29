import { Router } from 'express'
import sql from '../db/client.js'
import { requireAnyRole } from '../middleware/auth.js'
import { validate, contentPlanSchema, contentPlanUpdateSchema } from '../validation/schemas.js'

const router = Router()

// GET /api/v1/content-plans
router.get('/', requireAnyRole, async (req, res) => {
  const { week, year, platform } = req.query
  const wk = week ? parseInt(week) : null
  const yr = year ? parseInt(year) : null
  const pf = platform && platform !== 'Alle' ? platform : null
  try {
    let plans
    if (req.user.role === 'admin') {
      plans = await sql`
        SELECT cp.*, c.real_name, c.artist_name, a.name as agency_name
        FROM content_plans cp
        JOIN creators c ON c.id = cp.creator_id
        JOIN agencies a ON a.id = cp.agency_id
        WHERE cp.deleted_at IS NULL
          AND (${wk}::int IS NULL OR cp.week_number = ${wk})
          AND (${yr}::int IS NULL OR cp.year = ${yr})
          AND (${pf}::text IS NULL OR cp.platform = ${pf})
        ORDER BY cp.created_at DESC
      `
    } else if (req.user.role === 'agency') {
      plans = await sql`
        SELECT cp.*, c.real_name, c.artist_name
        FROM content_plans cp
        JOIN creators c ON c.id = cp.creator_id
        WHERE cp.agency_id = ${req.user.agency_id}
          AND cp.visible_to_agency = true
          AND cp.deleted_at IS NULL
          AND (${wk}::int IS NULL OR cp.week_number = ${wk})
          AND (${yr}::int IS NULL OR cp.year = ${yr})
          AND (${pf}::text IS NULL OR cp.platform = ${pf})
        ORDER BY cp.created_at DESC
      `
    } else {
      plans = await sql`
        SELECT * FROM content_plans
        WHERE creator_id = ${req.user.creator_id} AND deleted_at IS NULL
          AND (${wk}::int IS NULL OR week_number = ${wk})
          AND (${yr}::int IS NULL OR year = ${yr})
          AND (${pf}::text IS NULL OR platform = ${pf})
        ORDER BY created_at DESC
      `
    }
    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/content-plans
router.post('/', requireAnyRole, validate(contentPlanSchema), async (req, res) => {
  try {
    const creatorId = req.user.creator_id
    const agencyId = req.user.agency_id

    if (req.user.role === 'creator' && !creatorId) {
      return res.status(400).json({ error: 'Kein Creator-Account verknüpft' })
    }

    const { week_number, year, platform, title, description, status, visible_to_agency } = req.body
    const [plan] = await sql`
      INSERT INTO content_plans (creator_id, agency_id, week_number, year, platform, title, description, status, visible_to_agency)
      VALUES (${creatorId}, ${agencyId}, ${week_number}, ${year}, ${platform}, ${title || null}, ${description || null}, ${status}, ${visible_to_agency})
      RETURNING *
    `
    res.status(201).json(plan)
  } catch (err) {
    console.error('Content plan create error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/content-plans/:id
router.patch('/:id', requireAnyRole, validate(contentPlanUpdateSchema), async (req, res) => {
  try {
    const f = req.body
    const id = req.params.id

    // Creator: nur eigene; Agency/Admin: nur eigene Agentur
    const [existing] = req.user.role === 'creator'
      ? await sql`SELECT * FROM content_plans WHERE id = ${id} AND creator_id = ${req.user.creator_id} AND deleted_at IS NULL`
      : req.user.role === 'agency'
        ? await sql`SELECT * FROM content_plans WHERE id = ${id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        : await sql`SELECT * FROM content_plans WHERE id = ${id} AND deleted_at IS NULL`

    if (!existing) return res.status(404).json({ error: 'Plan nicht gefunden' })

    const [plan] = await sql`
      UPDATE content_plans SET
        title             = COALESCE(${f.title ?? null}, title),
        description       = COALESCE(${f.description ?? null}, description),
        status            = COALESCE(${f.status ?? null}, status),
        visible_to_agency = COALESCE(${f.visible_to_agency ?? null}, visible_to_agency),
        platform          = COALESCE(${f.platform ?? null}, platform)
      WHERE id = ${id}
      RETURNING *
    `
    res.json(plan)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/content-plans/:id — Soft delete
router.delete('/:id', requireAnyRole, async (req, res) => {
  try {
    const id = req.params.id
    const [existing] = req.user.role === 'creator'
      ? await sql`SELECT id FROM content_plans WHERE id = ${id} AND creator_id = ${req.user.creator_id} AND deleted_at IS NULL`
      : req.user.role === 'agency'
        ? await sql`SELECT id FROM content_plans WHERE id = ${id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        : await sql`SELECT id FROM content_plans WHERE id = ${id} AND deleted_at IS NULL`

    if (!existing) return res.status(404).json({ error: 'Plan nicht gefunden' })
    await sql`UPDATE content_plans SET deleted_at = now() WHERE id = ${id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
