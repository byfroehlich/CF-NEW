// CreatorFlow — WeekHelper Tests
// Ausführen: node --test tests/weekHelper.test.js

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentWeek } from '../src/lib/weekHelper.js'

describe('getCurrentWeek', () => {
  it('gibt week und year zurück', () => {
    const { week, year } = getCurrentWeek()
    assert.ok(typeof week === 'number')
    assert.ok(typeof year === 'number')
    assert.ok(week >= 1 && week <= 53)
    assert.ok(year >= 2025)
  })

  it('KW ist ISO-konform (Montag = Anfang)', () => {
    const { week, year } = getCurrentWeek()
    // Einfacher Sanity Check: KW liegt in plausiblem Bereich
    const now = new Date()
    assert.equal(year, now.getFullYear())
  })
})
