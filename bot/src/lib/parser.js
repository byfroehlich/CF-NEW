const PLATFORM_PATTERNS = {
  IG: [/instagram\.com/, /instagr\.am/],
  TK: [/tiktok\.com/, /vm\.tiktok\.com/],
  OF: [/onlyfans\.com/],
  FL: [/fansly\.com/],
  ML: [/maloum\.com/, /maloum\.de/],
}

const SECTION_EMOJIS = {
  beispiel:    ['🎥', '📹', '🎦'],
  sound:       ['🎵', '🎶', '🎼'],
  kleidung:    ['🩱', '👗', '👕', '🎽'],
  hintergrund: ['🏠', '🏡'],
  video:       ['🎬', '🎭'],
  script:      ['📝', '📋'],
  caption:     ['✏️', '🖊️', '✍️'],
}

const LOCATION_MAP = {
  indoor:  ['zuhause', 'zimmer', 'bett', 'küche', 'bad', 'drinnen', 'innen', 'wohnung'],
  outdoor: ['draußen', 'outdoor', 'park', 'garten', 'strand', 'außen'],
  auto:    ['auto', 'car', 'fahrt', 'fahrzeug'],
  stadt:   ['stadt', 'city', 'urban', 'straße'],
}

export function extractLinks(text) {
  if (!text) return []
  const urlRegex = /https?:\/\/[^\s\)\]\"\'\'<>]+/gi
  return [...text.matchAll(urlRegex)].map(m => m[0].replace(/[.,;!?]+$/, ''))
}

export function detectPlatform(url) {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some(p => p.test(url))) return platform
  }
  return 'OTHER'
}

function detectSectionKey(line) {
  const trimmed = line.trim()
  for (const [key, emojis] of Object.entries(SECTION_EMOJIS)) {
    if (emojis.some(e => trimmed.startsWith(e))) return key
  }
  return null
}

function detectLocationTags(text) {
  const lower = text.toLowerCase()
  const tags = []
  for (const [tag, keywords] of Object.entries(LOCATION_MAP)) {
    if (keywords.some(k => lower.includes(k))) tags.push(tag)
  }
  return tags
}

// Parst eine "Liste"-Nachricht der Agentur in strukturierte Job-Felder
export function parseListeMessage(text) {
  if (!text || !text.trim().startsWith('Liste')) return null

  const lines = text.split('\n')
  const title = lines[0].trim()

  const sections = {}
  let currentKey = null
  let currentLines = []

  for (let i = 1; i < lines.length; i++) {
    const key = detectSectionKey(lines[i])
    if (key) {
      if (currentKey) sections[currentKey] = currentLines.join('\n').trim()
      currentKey = key
      currentLines = []
    } else if (currentKey) {
      currentLines.push(lines[i])
    }
  }
  if (currentKey) sections[currentKey] = currentLines.join('\n').trim()

  const sourceLink = extractLinks(sections.beispiel || '')[0] || null
  const platform   = sourceLink ? detectPlatform(sourceLink) : 'OTHER'

  // Requisiten = Sound + Hintergrund kombiniert
  const requisiten = [
    sections.sound       ? `Sound: ${sections.sound}`       : null,
    sections.hintergrund ? `Hintergrund: ${sections.hintergrund}` : null,
  ].filter(Boolean).join('\n') || null

  const locationTags = detectLocationTags(title + ' ' + (sections.hintergrund || ''))

  return {
    title,
    source_link:   sourceLink,
    platform,
    kleidung:      sections.kleidung      || null,
    requisiten,
    description:   sections.video         || null,
    script:        sections.script        || null,
    caption:       sections.caption       || null,
    location_tags: locationTags,
  }
}
