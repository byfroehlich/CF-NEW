import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLogs, getLogStats } from '../lib/api.js'

const LEVEL_CONFIG = {
  info:  { label: 'Info',    classes: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  warn:  { label: 'Warnung', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  error: { label: 'Fehler',  classes: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500' },
}

const EVENT_LABELS = {
  jobs_created:         '📥 Jobs angelegt',
  reply_matched:        '✅ Video geliefert',
  reply_no_job:         '⚠️ Reply ohne Job',
  reply_duplicate:      'ℹ️ Doppelte Lieferung',
  creator_not_found:    '⚠️ Creator nicht gefunden',
  manual_done:          '✏️ Manuell erledigt',
  manual_carry:         '↩ Manueller Übertrag',
  cron_carry:           '🔄 Auto-Übertrag',
  cron_carry_error:     '❌ Übertrag Fehler',
  message_handler_error:'❌ Nachrichten-Fehler',
  reply_handler_error:  '❌ Reply-Fehler',
  command_error:        '❌ Command-Fehler',
  heartbeat:            '💓 Heartbeat',
  bot_start:            '🚀 Bot gestartet',
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function timeSince(ts) {
  if (!ts) return '—'
  const seconds = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (seconds < 60) return `vor ${seconds}s`
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)}min`
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)}h`
  return `vor ${Math.floor(seconds / 86400)}d`
}

function HealthCard({ label, value, ok, sub }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${ok ? 'border-green-200' : 'border-red-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function SystemLog() {
  const [level, setLevel] = useState('all')
  const [source, setSource] = useState('all')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['log-stats'],
    queryFn: getLogStats,
    refetchInterval: 30_000,
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['logs', level, source],
    queryFn: () => getLogs({
      ...(level !== 'all' && { level }),
      ...(source !== 'all' && { source }),
      limit: 150,
    }),
    refetchInterval: 30_000,
  })

  // Bot gilt als online wenn Heartbeat in letzten 10 Minuten
  const botOnline = stats?.last_heartbeat &&
    (Date.now() - new Date(stats.last_heartbeat)) < 10 * 60 * 1000

  return (
    <div className="space-y-6">
      {/* Health Overview */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          System-Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthCard
            label="Bot"
            value={botOnline ? 'Online' : 'Offline'}
            ok={botOnline}
            sub={`Heartbeat ${timeSince(stats?.last_heartbeat)}`}
          />
          <HealthCard
            label="Fehler (1h)"
            value={statsLoading ? '…' : stats?.error_1h ?? 0}
            ok={!stats?.error_1h || stats.error_1h === 0}
            sub="Letzte Stunde"
          />
          <HealthCard
            label="Letzter Job"
            value={timeSince(stats?.last_job)}
            ok={!!stats?.last_job}
            sub="Job angelegt"
          />
          <HealthCard
            label="Letzte Lieferung"
            value={timeSince(stats?.last_delivery)}
            ok={!!stats?.last_delivery}
            sub="Video empfangen"
          />
        </div>
      </div>

      {/* 24h Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{stats?.info_24h ?? '–'}</div>
          <div className="text-xs text-green-600 mt-0.5">Info (24h)</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats?.warn_24h ?? '–'}</div>
          <div className="text-xs text-yellow-600 mt-0.5">Warnungen (24h)</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{stats?.error_24h ?? '–'}</div>
          <div className="text-xs text-red-600 mt-0.5">Fehler (24h)</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'info', 'warn', 'error'].map(l => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              level === l
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {l === 'all' ? 'Alle Level' : l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {['all', 'bot', 'api', 'cron'].map(s => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              source === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'Alle Quellen' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="space-y-1.5">
        {logsLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Lädt…</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Keine Logs gefunden.</div>
        ) : logs.map(log => {
          const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info
          const eventLabel = EVENT_LABELS[log.event] || log.event
          return (
            <div
              key={log.id}
              className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${cfg.classes}`}
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{eventLabel}</span>
                  <span className="text-xs opacity-60 font-mono">{log.source}</span>
                </div>
                <div className="mt-0.5 opacity-80">{log.message}</div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs opacity-60 cursor-pointer hover:opacity-80">
                      Details anzeigen
                    </summary>
                    <pre className="mt-1 text-xs bg-black/10 rounded p-2 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <span className="text-xs opacity-50 flex-shrink-0 font-mono whitespace-nowrap">
                {formatTime(log.created_at)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Automatische Aktualisierung alle 30 Sekunden
      </p>
    </div>
  )
}
