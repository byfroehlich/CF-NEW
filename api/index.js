import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from 'dotenv'
import cron from 'node-cron'
import authRoutes        from './src/routes/auth.js'
import agencyRoutes      from './src/routes/agencies.js'
import creatorRoutes     from './src/routes/creators.js'
import jobRoutes         from './src/routes/jobs.js'
import contentPlanRoutes from './src/routes/content-plans.js'
import logRoutes         from './src/routes/logs.js'
import sql               from './src/db/client.js'

config()

const app = express()
const ALLOWED = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ALLOWED],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}))

app.use(cors({ origin: ALLOWED, credentials: true }))
app.use(express.json({ limit: '10kb' }))

app.use('/api/', rateLimit({
  windowMs: 60_000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warte eine Minute.' }
}))

app.use('/api/v1/auth',          authRoutes)
app.use('/api/v1/agencies',      agencyRoutes)
app.use('/api/v1/creators',      creatorRoutes)
app.use('/api/v1/jobs',          jobRoutes)
app.use('/api/v1/content-plans', contentPlanRoutes)
app.use('/api/v1/logs',          logRoutes)

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// DSGVO Log-Cleanup (Fallback falls Bot down)
cron.schedule('30 3 * * *', async () => {
  try {
    await sql`DELETE FROM logs WHERE created_at < now() - interval '90 days'`
    console.log('API Cron: alte Logs gelöscht')
  } catch (err) { console.error('Log-Cleanup:', err.message) }
})

app.use((req, res) => res.status(404).json({ error: 'Route nicht gefunden' }))
app.use((err, req, res, next) => {
  console.error('Unhandled:', err)
  res.status(500).json({ error: 'Interner Serverfehler' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`✅ CreatorFlow API v1 — Port ${PORT}`))
