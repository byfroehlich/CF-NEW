// CreatorFlow — Auth Tests
// Ausführen: node --test tests/auth.test.js
// Voraussetzung: TEST_DATABASE_URL in .env.test

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.TEST_API_URL || 'http://localhost:3001'

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return { status: res.status, body: await res.json() }
}

describe('Auth', () => {
  it('Login mit falschen Credentials → 401', async () => {
    const { status } = await post('/api/v1/auth/login', {
      email: 'falsch@test.de',
      password: 'falschesPasswort123!'
    })
    assert.equal(status, 401)
  })

  it('Login mit fehlender Email → 400', async () => {
    const { status, body } = await post('/api/v1/auth/login', {
      password: 'test'
    })
    assert.equal(status, 400)
    assert.ok(body.details)
  })

  it('Rate Limiting greift nach 10 Fehlversuchen', async () => {
    const results = []
    for (let i = 0; i < 12; i++) {
      const { status } = await post('/api/v1/auth/login', {
        email: 'rate@test.de', password: 'falsch123!'
      })
      results.push(status)
    }
    assert.ok(results.includes(429), 'Rate Limit sollte nach 10 Versuchen greifen')
  })
})

describe('Datenisolation', () => {
  let creatorToken, adminToken

  before(async () => {
    // Login als Creator und Admin
    const cr = await post('/api/v1/auth/login', {
      email: process.env.TEST_CREATOR_EMAIL,
      password: process.env.TEST_CREATOR_PASS
    })
    const ad = await post('/api/v1/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASS
    })
    creatorToken = cr.body.access_token
    adminToken = ad.body.access_token
  })

  it('Creator kann keine Admin-Routen aufrufen', async () => {
    const { status } = await get('/api/v1/creators', creatorToken)
    assert.equal(status, 403)
  })

  it('Creator sieht nur eigene Jobs', async () => {
    const { status, body } = await get('/api/v1/jobs', creatorToken)
    assert.equal(status, 200)
    // Alle zurückgegebenen Jobs müssen dem Creator gehören
    const user = JSON.parse(
      Buffer.from(creatorToken.split('.')[1], 'base64').toString()
    )
    body.forEach(job => {
      assert.equal(job.creator_id, user.creator_id,
        'Job gehört nicht dem eingeloggten Creator')
    })
  })

  it('Unauthentifizierter Zugriff → 401', async () => {
    const { status } = await get('/api/v1/jobs', 'ungültigerToken')
    assert.equal(status, 401)
  })

  it('Admin sieht alle Jobs', async () => {
    const { status } = await get('/api/v1/jobs', adminToken)
    assert.equal(status, 200)
  })
})

describe('Job Status Flow', () => {
  it('Ungültiger Status → 400', async () => {
    // Benötigt eine gültige Job-ID aus der Test-DB
    const jobId = process.env.TEST_JOB_ID
    if (!jobId) return // Skip wenn nicht konfiguriert

    const cr = await post('/api/v1/auth/login', {
      email: process.env.TEST_CREATOR_EMAIL,
      password: process.env.TEST_CREATOR_PASS
    })
    const token = cr.body.access_token

    const res = await fetch(`${BASE}/api/v1/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'ungültigerStatus' })
    })
    assert.equal(res.status, 400)
  })
})
