import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import sql from '../db/client.js'
import { validate, loginSchema, setupUserSchema } from '../validation/schemas.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.' },
  skipSuccessfulRequests: true,
})

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role,
      creator_id: user.creator_id, agency_id: user.agency_id },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
  const refreshToken = crypto.randomBytes(64).toString('hex')
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  return { accessToken, refreshToken, refreshHash }
}

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body
  try {
    const [user] = await sql`
      SELECT * FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1
    `
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account gesperrt. Bitte später versuchen.' })
    }
    const valid = user && await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      if (user) {
        const attempts = (user.failed_attempts || 0) + 1
        const lockUntil = attempts >= 10 ? new Date(Date.now() + 30 * 60 * 1000) : null
        await sql`UPDATE users SET failed_attempts = ${attempts}, locked_until = ${lockUntil} WHERE id = ${user.id}`
      }
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' })
    }
    await sql`UPDATE users SET failed_attempts = 0, locked_until = null, last_login = now() WHERE id = ${user.id}`
    const { accessToken, refreshToken, refreshHash } = generateTokens(user)
    await sql`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (${user.id}, ${refreshHash}, now() + interval '30 days')`
    res.json({ access_token: accessToken, refresh_token: refreshToken, role: user.role, creator_id: user.creator_id, agency_id: user.agency_id })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body
  if (!refresh_token) return res.status(400).json({ error: 'Refresh Token fehlt' })
  try {
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex')
    const [stored] = await sql`
      SELECT rt.*, u.id as uid, u.email, u.role, u.creator_id, u.agency_id
      FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ${tokenHash} AND rt.revoked = false AND rt.expires_at > now() LIMIT 1
    `
    if (!stored) return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' })
    await sql`UPDATE refresh_tokens SET revoked = true WHERE token_hash = ${tokenHash}`
    const user = { id: stored.uid, email: stored.email, role: stored.role, creator_id: stored.creator_id, agency_id: stored.agency_id }
    const { accessToken, refreshToken: newRefresh, refreshHash } = generateTokens(user)
    await sql`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (${stored.uid}, ${refreshHash}, now() + interval '30 days')`
    res.json({ access_token: accessToken, refresh_token: newRefresh })
  } catch (err) {
    console.error('Refresh error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

router.post('/logout', async (req, res) => {
  const { refresh_token } = req.body
  if (refresh_token) {
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex')
    await sql`UPDATE refresh_tokens SET revoked = true WHERE token_hash = ${tokenHash}`
  }
  res.json({ ok: true })
})

router.post('/setup', validate(setupUserSchema), async (req, res) => {
  if (!process.env.SETUP_KEY || process.env.SETUP_KEY !== req.headers['x-setup-key']) {
    return res.status(403).json({ error: 'Kein Zugriff' })
  }
  try {
    const { email, password, role, agency_id, creator_id } = req.body
    const hash = await bcrypt.hash(password, 12)
    const [user] = await sql`
      INSERT INTO users (email, password_hash, role, agency_id, creator_id)
      VALUES (${email}, ${hash}, ${role}, ${agency_id || null}, ${creator_id || null})
      RETURNING id, email, role
    `
    res.json(user)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vergeben' })
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
