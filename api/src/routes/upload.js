import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAnyRole } from '../middleware/auth.js'

const router = Router()

// Ensure uploads directory exists
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads'
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = req.query.type === 'id_document' ? 'id' : 'photos'
    const dir = path.join(UPLOADS_DIR, subdir)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    const safe = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40)
    cb(null, `${Date.now()}_${safe}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Nur JPEG/PNG/WebP/HEIC erlaubt'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: req => req?.query?.type === 'id_document' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
  }
})

// POST /api/v1/upload?type=photo|id_document
router.post('/', requireAnyRole, (req, res, next) => {
  const limit = req.query.type === 'id_document' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
  const uploadSingle = multer({
    storage,
    fileFilter,
    limits: { fileSize: limit }
  }).single('file')

  uploadSingle(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload fehlgeschlagen' })
    }
    if (!req.file) return res.status(400).json({ error: 'Keine Datei übermittelt' })

    const BASE = process.env.API_BASE_URL || `http://localhost:3001`
    const url = `${BASE}/uploads/${req.query.type === 'id_document' ? 'id' : 'photos'}/${req.file.filename}`
    res.json({ url, filename: req.file.filename })
  })
})

export default router
