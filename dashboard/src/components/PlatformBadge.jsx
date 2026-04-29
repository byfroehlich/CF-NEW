const CONFIG = {
  IG:    { label: 'Instagram', classes: 'bg-pink-50 text-pink-700' },
  TK:    { label: 'TikTok',    classes: 'bg-gray-900 text-white' },
  OF:    { label: 'OnlyFans',  classes: 'bg-sky-50 text-sky-700' },
  FL:    { label: 'Fansly',    classes: 'bg-blue-50 text-blue-700' },
  ML:    { label: 'Maloum',    classes: 'bg-purple-50 text-purple-700' },
  OTHER: { label: 'Sonstige',  classes: 'bg-gray-100 text-gray-600' },
}

export default function PlatformBadge({ platform }) {
  const cfg = CONFIG[platform] || CONFIG.OTHER
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
