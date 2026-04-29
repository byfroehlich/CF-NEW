export default function WeekNav({ week, year, onChange }) {
  function prev() {
    if (week === 1) onChange(52, year - 1)
    else onChange(week - 1, year)
  }
  function next() {
    if (week === 52) onChange(1, year + 1)
    else onChange(week + 1, year)
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">‹</button>
      <span className="font-medium">KW {week} / {year}</span>
      <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">›</button>
    </div>
  )
}
