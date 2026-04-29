import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert' })
  }
  try {
    const token = header.split(' ')[1]
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token abgelaufen', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: 'Token ungültig' })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    next()
  })
}

export function requireAgencyOrAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'agency'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    next()
  })
}

export function requireAnyRole(req, res, next) {
  requireAuth(req, res, next)
}
