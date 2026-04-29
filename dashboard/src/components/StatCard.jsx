export default function StatCard({ label, value, color = 'gray', topBar = false }) {
  const textColors = { gray: 'text-gray-900', red: 'text-red-500', orange: 'text-orange-500', green: 'text-green-500', yellow: 'text-yellow-500' }
  const barColors  = { gray: 'bg-gray-400', red: 'bg-red-400', orange: 'bg-orange-400', green: 'bg-green-400', yellow: 'bg-yellow-400' }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {topBar && <div className={`h-1 ${barColors[color]}`} />}
      <div className="p-4 text-center">
        <div className={`text-3xl font-bold ${topBar ? 'text-gray-900' : textColors[color]}`}>{value ?? '–'}</div>
        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  )
}
