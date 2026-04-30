import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import sql from '../db/client.js'
import { requireAnyRole, requireAgencyOrAdmin } from '../middleware/auth.js'

const router = Router({ mergeParams: true })

const LIMITS = { profile: 1, role: 5, id_document: 2 }

// GET /api/v1/creators/:id/photos
router.get('/', requireAnyRole, async (req, res) => {
  const { id } = req.params
  const { role, agency_id, creator_id } = req.user
  try {
    // Creators can only see own photos (not id_document of others)
    if (role === 'creator') {
      if (creator_id !== id) return res.status(403).json({ error: 'Kein Zugriff' })
      const photos = await sql`
        SELECT id, type, url, label, sort_order, created_at
        FROM creator_photos WHERE creator_id = ${id} AND deleted_at IS NULL
        ORDER BY type, sort_order, created_at
      `
      return res.json(photos)
    }
    // Agency: only own creators, no id_document
    if (role === 'agency') {
      const [creator] = await sql`SELECT id FROM creators WHERE id = ${id} AND agency_id = ${agency_id} AND deleted_at IS NULL`
      if (!creator) return res.status(404).json({ error: 'Creator nicht gefunden' })
      const photos = await sql`
        SELECT id, type, url, label, sort_order, created_at
        FROM creator_photos WHERE creator_id = ${id} AND type != 'id_document' AND deleted_at IS NULL
        ORDER BY type, sort_order, created_at
      `
      return res.json(photos)
    }
    // Admin: all photos
    const photos = await sql`
      SELECT id, type, url, label, sort_order, created_at
      FROM creator_photos WHERE creator_id = ${id} AND deleted_at IS NULL
      ORDER BY type, sort_order, created_at
    `
    res.json(photos)
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/v1/creators/:id/photos — add photo record after upload
router.post('/', requireAnyRole, async (req, res) => {
  const { id } = req.params
  const { role, agency_id, creator_id } = req.user
  const { url, type = 'profile', label = null, sort_order = 0 } = req.body

  if (!url) return res.status(400).json({ error: 'url fehlt' })
  const validTypes = ['profile', 'role', 'id_document']
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Ungültiger Typ' })

  // Creators can only add own photos (not id_document via this route — use /me/photos)
  if (role === 'creator' && creator_id !== id) return res.status(403).json({ error: 'Kein Zugriff' })
  if (role === 'agency') {
    const [c] = await sql`SELECT id FROM creators WHERE id = ${id} AND agency_id = ${agency_id} AND deleted_at IS NULL`
    if (!c) return res.status(404).json({ error: 'Creator nicht gefunden' })
    if (type === 'id_document') return res.status(403).json({ error: 'ID-Dokumente nur Creator oder Admin' })
  }

  try {
    // Enforce limits
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM creator_photos
      WHERE creator_id = ${id} AND type = ${type} AND deleted_at IS NULL
    `
    if (parseInt(count) >= LIMITS[type]) {
      return res.status(409).json({ error: `Maximal ${LIMITS[type]} Foto(s) vom Typ "${type}" erlaubt` })
    }

    // If adding new profile photo, soft-delete old ones first
    if (type === 'profile') {
      await sql`UPDATE creator_photos SET deleted_at = now() WHERE creator_id = ${id} AND type = 'profile' AND deleted_at IS NULL`
    }

    const [photo] = await sql`
      INSERT INTO creator_photos (creator_id, url, type, label, sort_order, uploaded_by)
      VALUES (${id}, ${url}, ${type}, ${label}, ${sort_order}, ${req.user.id})
      RETURNING id, type, url, label, sort_order, created_at
    `

    // Also update photo_url on creators table if it's a profile photo
    if (type === 'profile') {
      await sql`UPDATE creators SET photo_url = ${url} WHERE id = ${id}`
    }
    // If it's an ID document, update activation_status
    if (type === 'id_document') {
      await sql`
        UPDATE creators SET activation_status = 'id_uploaded'
        WHERE id = ${id} AND activation_status = 'pending'
      `
    }

    res.status(201).json(photo)
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/v1/creators/:id/photos/:photoId — update label/sort
router.patch('/:photoId', requireAgencyOrAdmin, async (req, res) => {
  const { id, photoId } = req.params
  const { label, sort_order } = req.body
  try {
    const [photo] = await sql`
      UPDATE creator_photos SET
        label = COALESCE(${label ?? null}, label),
        sort_order = COALESCE(${sort_order ?? null}, sort_order)
      WHERE id = ${photoId} AND creator_id = ${id} AND deleted_at IS NULL
      RETURNING id, type, url, label, sort_order
    `
    if (!photo) return res.status(404).json({ error: 'Foto nicht gefunden' })
    res.json(photo)
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/v1/creators/:id/photos/:photoId
router.delete('/:photoId', requireAnyRole, async (req, res) => {
  const { id, photoId } = req.params
  const { role, agency_id, creator_id } = req.user
  try {
    let query
    if (role === 'creator') {
      if (creator_id !== id) return res.status(403).json({ error: 'Kein Zugriff' })
      query = sql`UPDATE creator_photos SET deleted_at = now() WHERE id = ${photoId} AND creator_id = ${id} AND type != 'id_document' AND deleted_at IS NULL RETURNING id, url`
    } else if (role === 'agency') {
      const [c] = await sql`SELECT id FROM creators WHERE id = ${id} AND agency_id = ${agency_id} AND deleted_at IS NULL`
      if (!c) return res.status(404).json({ error: 'Creator nicht gefunden' })
      query = sql`UPDATE creator_photos SET deleted_at = now() WHERE id = ${photoId} AND creator_id = ${id} AND type != 'id_document' AND deleted_at IS NULL RETURNING id, url`
    } else {
      query = sql`UPDATE creator_photos SET deleted_at = now() WHERE id = ${photoId} AND creator_id = ${id} AND deleted_at IS NULL RETURNING id, url`
    }
    const [photo] = await query
    if (!photo) return res.status(404).json({ error: 'Foto nicht gefunden' })

    // Delete file from disk
    try {
      const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads'
      const urlPath = new URL(photo.url).pathname
      const filePath = path.join(UPLOADS_DIR, urlPath.replace('/uploads/', ''))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignore fs errors */ }

    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
