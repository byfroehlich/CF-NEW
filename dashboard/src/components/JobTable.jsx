import StatusBadge from './StatusBadge.jsx'
import PlatformBadge from './PlatformBadge.jsx'

export default function JobTable({ jobs, onStatusChange }) {
  if (!jobs?.length) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Keine Jobs für diese Auswahl.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Creator</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Plattform</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">KW</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Link</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map(job => (
            <tr key={job.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">
                {job.creator_name}
                {job.carried_over_from && (
                  <span className="ml-2 text-xs text-orange-500">↩</span>
                )}
              </td>
              <td className="px-4 py-3">
                <PlatformBadge platform={job.platform} />
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                KW{job.week_number}/{job.year}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 max-w-[160px]">
                {job.source_link ? (
                  <a
                    href={job.source_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline truncate block text-xs"
                  >
                    {job.source_link.replace(/https?:\/\//, '').slice(0, 30)}…
                  </a>
                ) : '–'}
              </td>
              <td className="px-4 py-3">
                {job.status === 'delivered' && (
                  <button
                    onClick={() => onStatusChange(job.id, 'confirmed')}
                    className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    ⭐ Bestätigen
                  </button>
                )}
                {job.status === 'open' && (
                  <button
                    onClick={() => onStatusChange(job.id, 'delivered')}
                    className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✓ Erledigt
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
