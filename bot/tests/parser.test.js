// CreatorFlow — Parser Tests
// Ausführen: node --test tests/parser.test.js

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractLinks, detectPlatform } from '../src/lib/parser.js'

describe('extractLinks', () => {
  it('erkennt Instagram-Link', () => {
    const links = extractLinks('Schau mal: https://instagram.com/reel/xyz123')
    assert.equal(links.length, 1)
    assert.ok(links[0].includes('instagram.com'))
  })

  it('erkennt mehrere Links in einer Nachricht', () => {
    const text = `
      1. https://instagram.com/reel/aaa
      2. https://onlyfans.com/video/bbb
      3. https://fansly.com/post/ccc
    `
    const links = extractLinks(text)
    assert.equal(links.length, 3)
  })

  it('ignoriert Text ohne Links', () => {
    const links = extractLinks('Guten Morgen, heute bitte 3 Reels erstellen')
    assert.equal(links.length, 0)
  })

  it('entfernt trailing Satzzeichen', () => {
    const links = extractLinks('Link: https://instagram.com/reel/xyz.')
    assert.equal(links[0].endsWith('.'), false)
  })

  it('gibt leeres Array bei leerem Text zurück', () => {
    assert.deepEqual(extractLinks(''), [])
    assert.deepEqual(extractLinks(null), [])
  })
})

describe('detectPlatform', () => {
  const cases = [
    ['https://instagram.com/reel/xyz', 'IG'],
    ['https://www.instagram.com/p/abc', 'IG'],
    ['https://tiktok.com/@user/video/123', 'TK'],
    ['https://vm.tiktok.com/xyz', 'TK'],
    ['https://onlyfans.com/video/123', 'OF'],
    ['https://fansly.com/post/abc', 'FL'],
    ['https://maloum.com/video/xyz', 'ML'],
    ['https://maloum.de/video/xyz', 'ML'],
    ['https://youtube.com/watch?v=abc', 'OTHER'],
  ]

  for (const [url, expected] of cases) {
    it(`erkennt ${expected} aus ${url}`, () => {
      assert.equal(detectPlatform(url), expected)
    })
  }
})
