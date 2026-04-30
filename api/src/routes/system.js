import { Router } from 'express'
import sql from '../db/client.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/v1/system/settings
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const rows = await sql`SELECT key, value, updated_at FROM system_settings ORDER BY key`
    const settings = {}
    for (const row of rows) settings[row.key] = row.value
    res.json(settings)
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/system/settings/:key
router.patch('/settings/:key', requireAdmin, async (req, res) => {
  const { key } = req.params
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value fehlt' })
  try {
    const [row] = await sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      RETURNING key, value, updated_at
    `
    res.json(row)
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
