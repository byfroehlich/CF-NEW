import PlatformIcon from './PlatformIcon.jsx'

const PLATFORMS = ['IG', 'TK', 'OF', 'FL', 'ML']

export default function PlatformFilter({ value, onChange, dark = false }) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* "Alle" text pill */}
      <button
        onClick={() => onChange('Alle')}
        className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
          value === 'Alle'
            ? dark ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'
            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
        }`}
      >
        Alle
      </button>

      {/* Platform icon squares */}
      {PLATFORMS.map(p => (
        <PlatformIcon
          key={p}
          platform={p}
          size="filter"
          active={value === p}
          onClick={() => onChange(p)}
        />
      ))}
    </div>
  )
}
