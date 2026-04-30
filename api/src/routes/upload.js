import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAnyRole } from '../middleware/auth.js'

const router = Router()

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.R2_BUCKET || 'creatorflow-uploads'
const PUBLIC_URL = process.env.R2_PUBLIC_URL // e.g. https://pub-xxx.r2.dev

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Nur JPEG/PNG/WebP/HEIC/PDF erlaubt'), false)
}

const memStorage = multer.memoryStorage()

router.post('/', requireAnyRole, (req, res) => {
  const isId = req.query.type === 'id_document'
  const limit = isId ? 10 * 1024 * 1024 : 5 * 1024 * 1024

  const upload = multer({ storage: memStorage, fileFilter, limits: { fileSize: limit } }).single('file')

  upload(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload fehlgeschlagen' })
    if (!req.file) return res.status(400).json({ error: 'Keine Datei übermittelt' })

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
    const safe = path.basename(req.file.originalname, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40)
    const filename = `${Date.now()}_${safe}${ext}`
    const key = `${isId ? 'id' : 'photos'}/${filename}`

    try {
      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }))

      const url = `${PUBLIC_URL}/${key}`
      res.json({ url, filename })
    } catch (e) {
      console.error('R2 upload error:', e)
      res.status(500).json({ error: 'Upload zu R2 fehlgeschlagen' })
    }
  })
})

export default router
