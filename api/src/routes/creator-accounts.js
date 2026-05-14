import { Router } from 'express'
import sql from '../db/client.js'
import { requireAnyRole } from '../middleware/auth.js'

const router = Router()

// GET /api/v1/creator-accounts
router.get('/', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') return res.json([])
  const creatorId = req.user.creator_id
  if (!creatorId) return res.json([])
  try {
    const accounts = await sql`
      SELECT id, name, created_at FROM creator_accounts
      WHERE creator_id = ${creatorId}::uuid AND deleted_at IS NULL
      ORDER BY created_at ASC
    `
    res.json(accounts)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/creator-accounts
router.post('/', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Nur Creator' })
  const creatorId = req.user.creator_id
  if (!creatorId) return res.status(400).json({ error: 'Kein Creator-Account verknüpft' })
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name erforderlich' })
  }
  try {
    const [account] = await sql`
      INSERT INTO creator_accounts (creator_id, name)
      VALUES (${creatorId}::uuid, ${name.trim()})
      RETURNING id, name, created_at
    `
    res.status(201).json(account)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/creator-accounts/:id — umbenennen
router.patch('/:id', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Nur Creator' })
  const creatorId = req.user.creator_id
  const id = req.params.id
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name erforderlich' })
  }
  try {
    const [account] = await sql`
      UPDATE creator_accounts SET name = ${name.trim()}
      WHERE id = ${id} AND creator_id = ${creatorId}::uuid AND deleted_at IS NULL
      RETURNING id, name, created_at
    `
    if (!account) return res.status(404).json({ error: 'Account nicht gefunden' })
    res.json(account)
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/creator-accounts/:id
router.delete('/:id', requireAnyRole, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Nur Creator' })
  const creatorId = req.user.creator_id
  const id = req.params.id
  try {
    const [existing] = await sql`
      SELECT id FROM creator_accounts
      WHERE id = ${id} AND creator_id = ${creatorId}::uuid AND deleted_at IS NULL
    `
    if (!existing) return res.status(404).json({ error: 'Account nicht gefunden' })
    await sql`UPDATE creator_accounts SET deleted_at = now() WHERE id = ${id}`
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
