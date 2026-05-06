// Platform icons — sized squares with brand colours + logos
// size: 'filter' (36px, used in filter bar), 'badge' (22px, used in cards)

const CFG = {
  IG: {
    label: 'Instagram',
    bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="3"/>
      </svg>
    ),
  },
  TK: {
    label: 'TikTok',
    bg: 'bg-black',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.75a8.27 8.27 0 0 0 4.84 1.54V6.81a4.85 4.85 0 0 1-1.07-.12z"/>
      </svg>
    ),
  },
  OF: {
    label: 'OnlyFans',
    bg: 'bg-[#00AFF0]',
    // Circle ring (O) + curved wing (F) — white on blue
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="white">
        {/* O: ring via evenodd donut */}
        <path fillRule="evenodd" d="
          M38,14 a34,34 0 1,0 0,68 a34,34 0 1,0 0,-68 Z
          M38,33 a15,15 0 1,1 0,30 a15,15 0 1,1 0,-30 Z
        "/>
        {/* F: wing curving up-right from the O */}
        <path d="M63,50 C70,38 86,35 88,23 C90,12 78,7 68,14 C60,20 58,32 61,42 Z"/>
      </svg>
    ),
  },
  FL: {
    label: 'Fansly',
    bg: 'bg-[#0F9BD7]',
    // Heart outline with inner circle — Fansly logo
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none" stroke="white">
        {/* Heart shape — two arcs meeting at bottom */}
        <path
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M50,82 C22,62 10,50 10,35 C10,21 21,13 32,13 C40,13 47,17 50,24 C53,17 60,13 68,13 C79,13 90,21 90,35 C90,50 78,62 50,82 Z"
        />
        {/* Inner circle */}
        <circle cx="50" cy="60" r="9" strokeWidth="7"/>
      </svg>
    ),
  },
  ML: {
    label: 'Maloum',
    bg: 'bg-[#E8421C]',
    // Rounded double-arch M — Maloum logo
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none" stroke="white">
        <path
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14,78 L14,50 Q14,22 36,22 Q50,22 50,44 Q50,22 64,22 Q86,22 86,50 L86,78"
        />
      </svg>
    ),
  },
  OTHER: {
    label: 'Sonstige',
    bg: 'bg-gray-400',
    icon: (s) => (
      <svg width={s * 0.7} height={s * 0.7} viewBox="0 0 24 24" fill="white">
        <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
      </svg>
    ),
  },
}

const SIZES = {
  filter: { box: 'w-11 h-11', text: 'text-[11px]', icon: 20 },
  badge:  { box: 'w-6 h-6',  text: 'text-[8px]',  icon: 13 },
  sm:     { box: 'w-8 h-8',  text: 'text-[9px]',  icon: 15 },
}

export default function PlatformIcon({ platform, size = 'badge', active = false, onClick, className = '' }) {
  const cfg = CFG[platform] || CFG.OTHER
  const s = SIZES[size] || SIZES.badge
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      onClick={onClick}
      className={`
        inline-flex items-center justify-center rounded-2xl flex-shrink-0
        ${s.box} ${cfg.bg}
        ${size === 'filter' ? 'shadow-md shadow-black/15' : ''}
        ${onClick ? 'cursor-pointer transition-all active:scale-95 ' + (active ? 'ring-2 ring-offset-2 ring-indigo-500 shadow-lg shadow-indigo-200' : 'opacity-75 hover:opacity-100 hover:shadow-lg') : ''}
        ${className}
      `}
      title={cfg.label}
    >
      {cfg.icon
        ? cfg.icon(s.icon)
        : <span className={`${s.text} ${cfg.textClass || 'text-white font-bold'}`}>{cfg.text}</span>
      }
    </Tag>
  )
}

export function PlatformLabel({ platform }) {
  return CFG[platform]?.label || platform
}
