import { Router } from 'express'
import sql from '../db/client.js'
import { requireAnyRole } from '../middleware/auth.js'
import { validate, contentPlanSchema, contentPlanUpdateSchema } from '../validation/schemas.js'

const router = Router()

// GET /api/v1/content-plans/stats
router.get('/stats', requireAnyRole, async (req, res) => {
  const { platform } = req.query
  const pf = platform && platform !== 'Alle' ? platform : null
  try {
    let totals, byPlatform, byMonth

    if (req.user.role === 'creator') {
      const creatorId = req.user.creator_id ?? null
      if (!creatorId) return res.json({ month_count: 0, quarter_count: 0, half_count: 0, year_count: 0, by_platform: [], by_month: [] })
      ;[totals] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month',   now()))::int AS month_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('quarter', now()))::int AS quarter_count,
          COUNT(*) FILTER (WHERE created_at >= CASE WHEN EXTRACT(MONTH FROM now()) <= 6
            THEN DATE_TRUNC('year', now())
            ELSE DATE_TRUNC('year', now()) + INTERVAL '6 months' END)::int         AS half_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('year',    now()))::int AS year_count
        FROM content_plans
        WHERE creator_id = ${creatorId}::uuid AND deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count
        FROM content_plans
        WHERE creator_id = ${creatorId}::uuid AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM content_plans
        WHERE creator_id = ${creatorId}::uuid AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR platform = ${pf})
        GROUP BY month ORDER BY month
      `
    } else if (req.user.role === 'agency') {
      const agencyId = req.user.agency_id ?? null
      if (!agencyId) return res.json({ month_count: 0, quarter_count: 0, half_count: 0, year_count: 0, by_platform: [], by_month: [] })
      ;[totals] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month',   now()))::int AS month_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('quarter', now()))::int AS quarter_count,
          COUNT(*) FILTER (WHERE created_at >= CASE WHEN EXTRACT(MONTH FROM now()) <= 6
            THEN DATE_TRUNC('year', now())
            ELSE DATE_TRUNC('year', now()) + INTERVAL '6 months' END)::int         AS half_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('year',    now()))::int AS year_count
        FROM content_plans
        WHERE agency_id = ${agencyId}::uuid AND visible_to_agency = true AND deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count
        FROM content_plans
        WHERE agency_id = ${agencyId}::uuid AND visible_to_agency = true AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM content_plans
        WHERE agency_id = ${agencyId}::uuid AND visible_to_agency = true AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR platform = ${pf})
        GROUP BY month ORDER BY month
      `
    } else {
      ;[totals] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month',   now()))::int AS month_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('quarter', now()))::int AS quarter_count,
          COUNT(*) FILTER (WHERE created_at >= CASE WHEN EXTRACT(MONTH FROM now()) <= 6
            THEN DATE_TRUNC('year', now())
            ELSE DATE_TRUNC('year', now()) + INTERVAL '6 months' END)::int         AS half_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('year',    now()))::int AS year_count
        FROM content_plans WHERE deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count FROM content_plans
        WHERE deleted_at IS NULL AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM content_plans WHERE deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR platform = ${pf})
        GROUP BY month ORDER BY month
      `
    }

    res.json({ ...totals, by_platform: byPlatform, by_month: byMonth })
  } catch (err) {
    console.error('Content plan stats error:', err)
    res.status(500).json({ error: 'Serverfehler', detail: err.message })
  }
})

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
        WHERE cp.agency_id = ${req.user.agency_id ?? null}
          AND cp.visible_to_agency = true
          AND cp.deleted_at IS NULL
          AND (${wk}::int IS NULL OR cp.week_number = ${wk})
          AND (${yr}::int IS NULL OR cp.year = ${yr})
          AND (${pf}::text IS NULL OR cp.platform = ${pf})
        ORDER BY cp.created_at DESC
      `
    } else {
      const creatorId = req.user.creator_id ?? null
      if (!creatorId) return res.json([])
      plans = await sql`
        SELECT * FROM content_plans
        WHERE creator_id = ${creatorId}::uuid AND deleted_at IS NULL
          AND (${wk}::int IS NULL OR week_number = ${wk})
          AND (${yr}::int IS NULL OR year = ${yr})
          AND (${pf}::text IS NULL OR platform = ${pf})
        ORDER BY created_at DESC
      `
    }
    res.json(plans)
  } catch (err) {
    console.error('Content plans GET error:', err.message, err.stack)
    res.status(500).json({ error: 'Serverfehler', detail: err.message })
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

    const { week_number, year, platform, title, description, source_link, status, visible_to_agency, partner_type, carried_over_from, posting_day, posting_time } = req.body
    const [plan] = await sql`
      INSERT INTO content_plans (creator_id, agency_id, week_number, year, platform, title, description, source_link, status, visible_to_agency, partner_type, carried_over_from, posting_day, posting_time)
      VALUES (${creatorId}, ${agencyId}, ${week_number}, ${year}, ${platform}, ${title || null}, ${description || null}, ${source_link || null}, ${status}, ${visible_to_agency}, ${partner_type}, ${carried_over_from || null}, ${posting_day || null}, ${posting_time || null})
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

    // Creator: nur eigene; Agency: nur eigene Agentur; Admin: alle
    const [existing] = req.user.role === 'creator'
      ? await sql`SELECT * FROM content_plans WHERE id = ${id} AND creator_id = ${req.user.creator_id} AND deleted_at IS NULL`
      : req.user.role === 'agency'
        ? await sql`SELECT * FROM content_plans WHERE id = ${id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        : await sql`SELECT * FROM content_plans WHERE id = ${id} AND deleted_at IS NULL`

    if (!existing) return res.status(404).json({ error: 'Plan nicht gefunden' })

    // Plan zwischen Accounts verschieben (Admin: beliebig; Agency: innerhalb eigener Agentur)
    let targetCreatorId = existing.creator_id
    let targetAgencyId  = existing.agency_id

    if (f.creator_id && f.creator_id !== existing.creator_id) {
      if (req.user.role === 'admin') {
        const [tc] = await sql`SELECT id, agency_id FROM creators WHERE id = ${f.creator_id} AND deleted_at IS NULL`
        if (!tc) return res.status(400).json({ error: 'Ziel-Creator nicht gefunden' })
        targetCreatorId = tc.id
        targetAgencyId  = tc.agency_id
      } else if (req.user.role === 'agency') {
        const [tc] = await sql`SELECT id, agency_id FROM creators WHERE id = ${f.creator_id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        if (!tc) return res.status(403).json({ error: 'Kein Zugriff auf diesen Creator' })
        targetCreatorId = tc.id
        targetAgencyId  = tc.agency_id
      } else if (req.user.role === 'creator') {
        const [tc] = await sql`SELECT id, agency_id FROM creators WHERE id = ${f.creator_id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        if (!tc) return res.status(403).json({ error: 'Kein Zugriff auf diesen Creator' })
        targetCreatorId = tc.id
        targetAgencyId  = tc.agency_id
      }
    }

    const [plan] = await sql`
      UPDATE content_plans SET
        creator_id        = ${targetCreatorId},
        agency_id         = ${targetAgencyId},
        title             = COALESCE(${f.title ?? null}, title),
        description       = COALESCE(${f.description ?? null}, description),
        source_link       = COALESCE(${f.source_link ?? null}, source_link),
        status            = COALESCE(${f.status ?? null}, status),
        visible_to_agency = COALESCE(${f.visible_to_agency ?? null}, visible_to_agency),
        platform          = COALESCE(${f.platform ?? null}, platform),
        partner_type      = COALESCE(${f.partner_type ?? null}, partner_type),
        week_number       = COALESCE(${f.week_number ?? null}, week_number),
        year              = COALESCE(${f.year ?? null}, year),
        posting_day       = CASE WHEN ${'posting_day' in f}::boolean THEN ${f.posting_day ?? null} ELSE posting_day END,
        posting_time      = CASE WHEN ${'posting_time' in f}::boolean THEN ${f.posting_time ?? null}::time ELSE posting_time END,
        pushed_to_week    = CASE WHEN ${'pushed_to_week' in f}::boolean THEN ${f.pushed_to_week ?? null} ELSE pushed_to_week END,
        pushed_to_year    = CASE WHEN ${'pushed_to_year' in f}::boolean THEN ${f.pushed_to_year ?? null} ELSE pushed_to_year END
      WHERE id = ${id}
      RETURNING *
    `
    res.json(plan)
  } catch (err) {
    console.error('Content plan update error:', err)
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
