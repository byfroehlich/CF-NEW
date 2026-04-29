export default function WeekFilter({ week, year, onChange }) {
  function shift(delta) {
    let w = week + delta
    let y = year
    if (w < 1) { w = 52; y -= 1 }
    if (w > 52) { w = 1; y += 1 }
    onChange(w, y)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-center">
        KW {week} / {year}
      </span>
      <button
        onClick={() => shift(1)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
      >
        ›
      </button>
    </div>
  )
}
