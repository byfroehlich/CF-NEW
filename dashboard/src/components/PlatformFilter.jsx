const PLATFORMS = ['Alle', 'IG', 'TK', 'OF', 'FL', 'ML']

export default function PlatformFilter({ value, onChange, dark = false }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PLATFORMS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === p
              ? dark ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
