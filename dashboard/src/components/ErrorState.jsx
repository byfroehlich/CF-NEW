export default function ErrorState({ error, onRetry }) {
  const isOffline = !navigator.onLine
  const isServerDown = error?.response?.status >= 500 || error?.code === 'ERR_NETWORK'

  if (isOffline) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-4xl mb-4">📡</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Internetverbindung</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Prüfe deine Verbindung und versuche es erneut.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Erneut versuchen
          </button>
        )}
      </div>
    )
  }

  if (isServerDown) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-4xl mb-4">🔧</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Server nicht erreichbar</h3>
        <p className="text-sm text-gray-500 mb-2 max-w-xs">
          Der Server antwortet gerade nicht. Das kann bei Render Free Tier
          beim ersten Zugriff des Tages bis zu 30 Sekunden dauern.
        </p>
        <p className="text-xs text-gray-400 mb-6">Bitte kurz warten und erneut versuchen.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Erneut versuchen
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Fehler aufgetreten</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        {error?.response?.data?.error || error?.message || 'Unbekannter Fehler'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  )
}
