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
    text: 'OF',
    textClass: 'font-black text-white tracking-tight',
  },
  FL: {
    label: 'Fansly',
    bg: 'bg-[#1877F2]',
    icon: (s) => (
      <svg width={s * 0.65} height={s * 0.65} viewBox="0 0 24 24" fill="white">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  ML: {
    label: 'Maloum',
    bg: 'bg-gradient-to-br from-violet-600 to-purple-800',
    text: 'ML',
    textClass: 'font-black text-white tracking-tight',
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
  filter: { box: 'w-10 h-10', text: 'text-[11px]', icon: 18 },
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
        inline-flex items-center justify-center rounded-xl flex-shrink-0
        ${s.box} ${cfg.bg}
        ${onClick ? 'cursor-pointer transition-all active:scale-95 ' + (active ? 'ring-2 ring-offset-1 ring-indigo-500' : 'opacity-80 hover:opacity-100') : ''}
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
