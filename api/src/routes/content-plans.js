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
        FROM content_plans cp JOIN creators c ON c.id = cp.creator_id
        WHERE (cp.agency_id = ${agencyId}::uuid OR c.agency_id = ${agencyId}::uuid)
          AND cp.visible_to_agency = true AND cp.deleted_at IS NULL
          AND (${pf}::text IS NULL OR cp.platform = ${pf})
      `
      byPlatform = await sql`
        SELECT cp.platform, COUNT(*)::int AS count
        FROM content_plans cp JOIN creators c ON c.id = cp.creator_id
        WHERE (cp.agency_id = ${agencyId}::uuid OR c.agency_id = ${agencyId}::uuid)
          AND cp.visible_to_agency = true AND cp.deleted_at IS NULL
          AND cp.created_at >= DATE_TRUNC('year', now())
        GROUP BY cp.platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', cp.created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM content_plans cp JOIN creators c ON c.id = cp.creator_id
        WHERE (cp.agency_id = ${agencyId}::uuid OR c.agency_id = ${agencyId}::uuid)
          AND cp.visible_to_agency = true AND cp.deleted_at IS NULL
          AND cp.created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR cp.platform = ${pf})
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
  const { week, year, platform, account_id, is_top_video } = req.query
  const wk = week ? parseInt(week) : null
  const yr = year ? parseInt(year) : null
  const pf = platform && platform !== 'Alle' ? platform : null
  const accountId = account_id || null
  const topOnly = is_top_video === 'true'
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
      const agencyId = req.user.agency_id ?? null
      plans = await sql`
        SELECT cp.*, c.real_name, c.artist_name
        FROM content_plans cp
        JOIN creators c ON c.id = cp.creator_id
        WHERE (cp.agency_id = ${agencyId} OR c.agency_id = ${agencyId})
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
          AND (${accountId}::uuid IS NULL OR account_id = ${accountId}::uuid)
          AND (${!topOnly}::boolean OR is_top_video = true)
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
    if (req.user.role === 'creator' && !creatorId) {
      return res.status(400).json({ error: 'Kein Creator-Account verknüpft' })
    }
    let agencyId = req.user.agency_id
    if (!agencyId && creatorId) {
      const [c] = await sql`SELECT agency_id FROM creators WHERE id = ${creatorId} AND deleted_at IS NULL`
      agencyId = c?.agency_id ?? null
    }

    const { week_number, year, platform, title, description, source_link, status, visible_to_agency, partner_type, carried_over_from, requisiten, kleidung, account_id, location_tags, post_date, post_time } = req.body
    const [plan] = await sql`
      INSERT INTO content_plans (creator_id, agency_id, week_number, year, platform, title, description, source_link, status, visible_to_agency, partner_type, carried_over_from, requisiten, kleidung, account_id, location_tags, post_date, post_time)
      VALUES (${creatorId}, ${agencyId}, ${week_number}, ${year}, ${platform}, ${title || null}, ${description || null}, ${source_link || null}, ${status}, ${visible_to_agency}, ${partner_type}, ${carried_over_from || null}, ${requisiten || null}, ${kleidung || null}, ${account_id || null}, ${location_tags || []}, ${post_date || null}, ${post_time || null})
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

    // Plan zwischen Creator-Accounts verschieben
    let targetCreatorId = existing.creator_id
    let targetAgencyId  = existing.agency_id

    if (f.creator_id && f.creator_id !== existing.creator_id) {
      if (req.user.role === 'admin') {
        const [tc] = await sql`SELECT id, agency_id FROM creators WHERE id = ${f.creator_id} AND deleted_at IS NULL`
        if (!tc) return res.status(400).json({ error: 'Ziel-Creator nicht gefunden' })
        targetCreatorId = tc.id; targetAgencyId = tc.agency_id
      } else {
        // Agency und Creator: nur innerhalb derselben Agentur
        const [tc] = await sql`SELECT id, agency_id FROM creators WHERE id = ${f.creator_id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        if (!tc) return res.status(403).json({ error: 'Kein Zugriff auf diesen Creator' })
        targetCreatorId = tc.id; targetAgencyId = tc.agency_id
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
        week_number       = CASE WHEN ${'week_number' in f}::boolean THEN ${f.week_number ?? null} ELSE week_number END,
        year              = CASE WHEN ${'year' in f}::boolean THEN ${f.year ?? null} ELSE year END,
        pushed_to_week    = CASE WHEN ${'pushed_to_week' in f}::boolean THEN ${f.pushed_to_week ?? null} ELSE pushed_to_week END,
        pushed_to_year    = CASE WHEN ${'pushed_to_year' in f}::boolean THEN ${f.pushed_to_year ?? null} ELSE pushed_to_year END,
        requisiten        = COALESCE(${f.requisiten ?? null}, requisiten),
        kleidung          = COALESCE(${f.kleidung ?? null}, kleidung),
        account_id        = CASE WHEN ${'account_id' in f}::boolean THEN ${f.account_id ?? null} ELSE account_id END,
        is_top_video      = COALESCE(${f.is_top_video ?? null}, is_top_video),
        location_tags     = CASE WHEN ${'location_tags' in f}::boolean THEN ${f.location_tags ?? []} ELSE location_tags END,
        post_date         = CASE WHEN ${'post_date' in f}::boolean THEN ${f.post_date ?? null} ELSE post_date END,
        post_time         = CASE WHEN ${'post_time' in f}::boolean THEN ${f.post_time ?? null} ELSE post_time END,
        posted_at         = CASE WHEN ${'posted_at' in f}::boolean THEN ${f.posted_at ?? null} ELSE posted_at END
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
