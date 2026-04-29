import { Router } from 'express'
import sql from '../db/client.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/v1/logs — Admin only
router.get('/', requireAdmin, async (req, res) => {
  const { level, source, limit = 200 } = req.query
  try {
    const lv = level && level !== 'Alle Level' ? level.toLowerCase() : null
    const src = source && source !== 'Alle Quellen' ? source.toLowerCase() : null
    const logs = await sql`
      SELECT id, level, source, event, message, metadata, created_at
      FROM logs
      WHERE (${lv}::text IS NULL OR level = ${lv})
        AND (${src}::text IS NULL OR source = ${src})
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/v1/logs/summary
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const [info] = await sql`SELECT COUNT(*)::int as count FROM logs WHERE level = 'info' AND created_at > now() - interval '24 hours'`
    const [warn] = await sql`SELECT COUNT(*)::int as count FROM logs WHERE level = 'warn' AND created_at > now() - interval '24 hours'`
    const [error] = await sql`SELECT COUNT(*)::int as count FROM logs WHERE level = 'error' AND created_at > now() - interval '1 hour'`
    const [lastJob] = await sql`SELECT created_at FROM jobs WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`
    const [lastDelivery] = await sql`SELECT received_at FROM deliveries ORDER BY received_at DESC LIMIT 1`
    res.json({
      info_24h:  info.count,
      warn_24h:  warn.count,
      error_1h:  error.count,
      last_job:  lastJob?.created_at || null,
      last_delivery: lastDelivery?.received_at || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
