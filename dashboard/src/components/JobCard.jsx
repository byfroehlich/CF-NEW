const STATUS_LABELS = { open: 'Offen', in_progress: 'In Arbeit', delivered: 'Geliefert', confirmed: 'Bestätigt', carried: 'Übertrag' }
const STATUS_COLORS = { open: 'bg-red-100 text-red-700', in_progress: 'bg-orange-100 text-orange-700', delivered: 'bg-green-100 text-green-700', confirmed: 'bg-blue-100 text-blue-700', carried: 'bg-yellow-100 text-yellow-700' }

export default function JobCard({ job, onStatusChange, isCreator = false }) {
  const next = { open: 'in_progress', in_progress: 'delivered', delivered: 'confirmed' }
  const nextLabel = { open: 'Starten', in_progress: 'Liefern', delivered: 'Bestätigen' }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase">{job.platform}</span>
          {!isCreator && <p className="text-sm font-medium text-gray-900 mt-0.5">{job.artist_name || job.real_name}</p>}
          {job.source_link && <a href={job.source_link} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline">Beispiel-Link</a>}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>{STATUS_LABELS[job.status]}</span>
      </div>
      {onStatusChange && next[job.status] && (
        <button
          onClick={() => onStatusChange(job.id, next[job.status])}
          className="w-full py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          {nextLabel[job.status]}
        </button>
      )}
    </div>
  )
}
