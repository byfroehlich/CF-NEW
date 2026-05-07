export default function WeekNav({ week, year, onChange, light = false }) {
  function prev() {
    if (week === 1) onChange(52, year - 1)
    else onChange(week - 1, year)
  }
  function next() {
    if (week === 52) onChange(1, year + 1)
    else onChange(week + 1, year)
  }
  const btn = light
    ? 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors'
    : 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors'
  const label = light ? 'font-semibold text-gray-800' : 'font-medium'
  return (
    <div className="flex items-center gap-1 text-sm whitespace-nowrap">
      <button onClick={prev} className={btn}>‹</button>
      <span className={label}>KW {week} / {year}</span>
      <button onClick={next} className={btn}>›</button>
    </div>
  )
}
