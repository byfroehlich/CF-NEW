import { Router } from 'express'
import sql from '../db/client.js'
import { requireAdmin, requireAgencyOrAdmin, requireAnyRole } from '../middleware/auth.js'
import { validate, jobSchema, jobStatusSchema } from '../validation/schemas.js'

const router = Router()

// GET /api/v1/jobs — alle Rollen, gefiltert nach Rolle
router.get('/', requireAnyRole, async (req, res) => {
  const { week, year, platform, creator_id, agency_id } = req.query
  try {
    let jobs
    const platformFilter = platform && platform !== 'Alle' ? platform : null
    const wk = week ? parseInt(week) : null
    const yr = year ? parseInt(year) : null

    if (req.user.role === 'admin') {
      jobs = await sql`
        SELECT j.*, c.real_name, c.artist_name, c.photo_url, a.name as agency_name
        FROM jobs j
        JOIN creators c ON c.id = j.creator_id
        JOIN agencies a ON a.id = j.agency_id
        WHERE j.deleted_at IS NULL
          AND (${wk}::int IS NULL OR j.week_number = ${wk})
          AND (${yr}::int IS NULL OR j.year = ${yr})
          AND (${platformFilter}::text IS NULL OR j.platform = ${platformFilter})
          AND (${creator_id || null}::uuid IS NULL OR j.creator_id = ${creator_id || null}::uuid)
          AND (${agency_id || null}::uuid IS NULL OR j.agency_id = ${agency_id || null}::uuid)
        ORDER BY j.created_at DESC
      `
    } else if (req.user.role === 'agency') {
      jobs = await sql`
        SELECT j.*, c.real_name, c.artist_name, c.photo_url
        FROM jobs j
        JOIN creators c ON c.id = j.creator_id
        WHERE j.agency_id = ${req.user.agency_id} AND j.deleted_at IS NULL
          AND (${wk}::int IS NULL OR j.week_number = ${wk})
          AND (${yr}::int IS NULL OR j.year = ${yr})
          AND (${platformFilter}::text IS NULL OR j.platform = ${platformFilter})
          AND (${creator_id || null}::uuid IS NULL OR j.creator_id = ${creator_id || null}::uuid)
        ORDER BY j.created_at DESC
      `
    } else {
      // creator: nur eigene
      jobs = await sql`
        SELECT j.*
        FROM jobs j
        WHERE j.creator_id = ${req.user.creator_id} AND j.deleted_at IS NULL
          AND (${wk}::int IS NULL OR j.week_number = ${wk})
          AND (${yr}::int IS NULL OR j.year = ${yr})
          AND (${platformFilter}::text IS NULL OR j.platform = ${platformFilter})
        ORDER BY j.created_at DESC
      `
    }
    res.json(jobs)
  } catch (err) {
    console.error('Jobs GET error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/jobs/stats — Zeitraum-Statistik für Creator/Agentur/Admin
router.get('/stats', requireAnyRole, async (req, res) => {
  const { platform } = req.query
  const pf = platform && platform !== 'Alle' ? platform : null
  try {
    let totals, byPlatform, byMonth

    if (req.user.role === 'creator') {
      ;[totals] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month',   now()))::int AS month_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('quarter', now()))::int AS quarter_count,
          COUNT(*) FILTER (WHERE created_at >= CASE WHEN EXTRACT(MONTH FROM now()) <= 6
            THEN DATE_TRUNC('year', now())
            ELSE DATE_TRUNC('year', now()) + INTERVAL '6 months' END)::int         AS half_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('year',    now()))::int AS year_count
        FROM jobs
        WHERE creator_id = ${req.user.creator_id} AND deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count
        FROM jobs
        WHERE creator_id = ${req.user.creator_id} AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM jobs
        WHERE creator_id = ${req.user.creator_id} AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR platform = ${pf})
        GROUP BY month ORDER BY month
      `
    } else if (req.user.role === 'agency') {
      ;[totals] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month',   now()))::int AS month_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('quarter', now()))::int AS quarter_count,
          COUNT(*) FILTER (WHERE created_at >= CASE WHEN EXTRACT(MONTH FROM now()) <= 6
            THEN DATE_TRUNC('year', now())
            ELSE DATE_TRUNC('year', now()) + INTERVAL '6 months' END)::int         AS half_count,
          COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('year',    now()))::int AS year_count
        FROM jobs
        WHERE agency_id = ${req.user.agency_id} AND deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count
        FROM jobs
        WHERE agency_id = ${req.user.agency_id} AND deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM jobs
        WHERE agency_id = ${req.user.agency_id} AND deleted_at IS NULL
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
        FROM jobs WHERE deleted_at IS NULL
          AND (${pf}::text IS NULL OR platform = ${pf})
      `
      byPlatform = await sql`
        SELECT platform, COUNT(*)::int AS count FROM jobs
        WHERE deleted_at IS NULL AND created_at >= DATE_TRUNC('year', now())
        GROUP BY platform ORDER BY count DESC
      `
      byMonth = await sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM jobs WHERE deleted_at IS NULL
          AND created_at >= DATE_TRUNC('year', now())
          AND (${pf}::text IS NULL OR platform = ${pf})
        GROUP BY month ORDER BY month
      `
    }

    res.json({ ...totals, by_platform: byPlatform, by_month: byMonth })
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/jobs/summary — Statistik, alle Rollen
router.get('/summary', requireAnyRole, async (req, res) => {
  const { week, year, creator_id, agency_id } = req.query
  const wk = week ? parseInt(week) : null
  const yr = year ? parseInt(year) : null
  try {
    let rows
    if (req.user.role === 'admin') {
      rows = await sql`
        SELECT status, COUNT(*)::int as count FROM jobs
        WHERE deleted_at IS NULL
          AND (${wk}::int IS NULL OR week_number = ${wk})
          AND (${yr}::int IS NULL OR year = ${yr})
          AND (${creator_id || null}::uuid IS NULL OR creator_id = ${creator_id || null}::uuid)
          AND (${agency_id || null}::uuid IS NULL OR agency_id = ${agency_id || null}::uuid)
        GROUP BY status
      `
    } else if (req.user.role === 'agency') {
      rows = await sql`
        SELECT status, COUNT(*)::int as count FROM jobs
        WHERE agency_id = ${req.user.agency_id} AND deleted_at IS NULL
          AND (${wk}::int IS NULL OR week_number = ${wk})
          AND (${yr}::int IS NULL OR year = ${yr})
          AND (${creator_id || null}::uuid IS NULL OR creator_id = ${creator_id || null}::uuid)
        GROUP BY status
      `
    } else {
      rows = await sql`
        SELECT status, COUNT(*)::int as count FROM jobs
        WHERE creator_id = ${req.user.creator_id} AND deleted_at IS NULL
          AND (${wk}::int IS NULL OR week_number = ${wk})
          AND (${yr}::int IS NULL OR year = ${yr})
        GROUP BY status
      `
    }
    const map = Object.fromEntries(rows.map(r => [r.status, r.count]))
    res.json({
      total:       (map.open || 0) + (map.in_progress || 0) + (map.delivered || 0) + (map.confirmed || 0) + (map.carried || 0),
      open:        map.open || 0,
      in_progress: map.in_progress || 0,
      delivered:   map.delivered || 0,
      confirmed:   map.confirmed || 0,
      carried:     map.carried || 0,
    })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/jobs — Admin oder Agency
router.post('/', requireAgencyOrAdmin, validate(jobSchema), async (req, res) => {
  try {
    const { creator_id, week_number, year, platform, content_type, source_link } = req.body

    // Sicherstellen dass creator zur Agentur gehört
    const [creator] = req.user.role === 'agency'
      ? await sql`SELECT id, agency_id FROM creators WHERE id = ${creator_id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
      : await sql`SELECT id, agency_id FROM creators WHERE id = ${creator_id} AND deleted_at IS NULL`

    if (!creator) return res.status(404).json({ error: 'Creator nicht gefunden' })

    const [job] = await sql`
      INSERT INTO jobs (creator_id, agency_id, week_number, year, platform, content_type, source_link)
      VALUES (${creator_id}, ${creator.agency_id}, ${week_number}, ${year}, ${platform}, ${content_type}, ${source_link || null})
      RETURNING *
    `
    await sql`
      INSERT INTO job_status_history (job_id, old_status, new_status, changed_by, changed_by_source)
      VALUES (${job.id}, null, 'open', ${req.user.id}, 'api')
    `
    res.status(201).json(job)
  } catch (err) {
    console.error('Job create error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/jobs/:id/status
router.patch('/:id/status', requireAnyRole, validate(jobStatusSchema), async (req, res) => {
  const { status, note } = req.body
  try {
    const [existing] = req.user.role === 'creator'
      ? await sql`SELECT * FROM jobs WHERE id = ${req.params.id} AND creator_id = ${req.user.creator_id} AND deleted_at IS NULL`
      : req.user.role === 'agency'
        ? await sql`SELECT * FROM jobs WHERE id = ${req.params.id} AND agency_id = ${req.user.agency_id} AND deleted_at IS NULL`
        : await sql`SELECT * FROM jobs WHERE id = ${req.params.id} AND deleted_at IS NULL`

    if (!existing) return res.status(404).json({ error: 'Job nicht gefunden' })

    // Timestamp-Spalte je nach Status setzen
    const tsUpdates = {
      in_progress: sql`, in_progress_at = now()`,
      delivered:   sql`, delivered_at = now()`,
      confirmed:   sql`, confirmed_at = now()`,
    }
    const tsFragment = tsUpdates[status] ?? sql``

    const [job] = await sql`
      UPDATE jobs SET status = ${status} ${tsFragment}
      WHERE id = ${req.params.id}
      RETURNING *
    `
    await sql`
      INSERT INTO job_status_history (job_id, old_status, new_status, changed_by, changed_by_source, note)
      VALUES (${job.id}, ${existing.status}, ${status}, ${req.user.id || null}, 'api', ${note || null})
    `
    res.json(job)
  } catch (err) {
    console.error('Status update error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/jobs/:id — Soft delete, Admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await sql`UPDATE jobs SET deleted_at = now() WHERE id = ${req.params.id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
