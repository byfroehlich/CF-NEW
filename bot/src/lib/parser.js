const PLATFORM_PATTERNS = {
  IG: [/instagram\.com/, /instagr\.am/],
  TK: [/tiktok\.com/, /vm\.tiktok\.com/],
  OF: [/onlyfans\.com/],
  FL: [/fansly\.com/],
  ML: [/maloum\.com/, /maloum\.de/],
}

export function extractLinks(text) {
  if (!text) return []
  const urlRegex = /https?:\/\/[^\s\)\]\"\'<>]+/gi
  return [...text.matchAll(urlRegex)].map(m => m[0].replace(/[.,;!?]+$/, ''))
}

export function detectPlatform(url) {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some(p => p.test(url))) return platform
  }
  return 'OTHER'
}
