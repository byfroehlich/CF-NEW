import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getJobStats, getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan } from '../lib/api.js'
import { clearAuth } from '../lib/auth.js'
import StatCard from '../components/StatCard.jsx'
import PlatformFilter from '../components/PlatformFilter.jsx'
import WeekNav from '../components/WeekNav.jsx'

function getCurrentWeek() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7), year: d.getUTCFullYear() }
}

const STATUS_LABELS = { open:'Offen', in_progress:'In Arbeit', delivered:'Geliefert', confirmed:'Bestätigt', carried:'Übertrag' }
const STATUS_COLORS = { open:'bg-red-100 text-red-700', in_progress:'bg-orange-100 text-orange-700', delivered:'bg-green-100 text-green-700', confirmed:'bg-blue-100 text-blue-700', carried:'bg-yellow-100 text-yellow-700' }
const PLAN_STATUS = { idea:'Idee', planned:'Geplant', filming:'Am Filmen', done:'Fertig' }
const PLAN_COLORS = { idea:'bg-gray-100 text-gray-600', planned:'bg-blue-100 text-blue-700', filming:'bg-orange-100 text-orange-700', done:'bg-green-100 text-green-700' }

// ── Gradient Header ─────────────────────────────────────────
function CreatorHeader({ tab, week, year, onWeekChange, onLogout }) {
  return (
    <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white px-6 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">CF</span>
          </div>
          <div>
            <div className="font-bold text-base leading-none">CreatorFlow</div>
            <div className="text-xs text-white/70 mt-0.5">KW {week}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <WeekNav week={week} year={year} onChange={onWeekChange} />
          <button onClick={onLogout} className="text-xs text-white/70 hover:text-white">Abmelden</button>
        </div>
      </div>

      {/* Pill-Tabs */}
      <div className="max-w-2xl mx-auto mt-4 flex gap-2">
        {['Aufträge','Mein Content','Statistik'].map(t => (
          <button key={t} onClick={() => {/* handled by parent */}}
            data-tab={t}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab===t ? 'bg-white text-violet-700' : 'text-white/80 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Aufträge Tab ─────────────────────────────────────────────
function AuftraegeTab({ week, year }) {
  const [platform, setPlatform] = useState('Alle')
  const { data: summary } = useQuery({ queryKey: ['summary-creator', week, year], queryFn: () => getJobSummary({ week, year }) })
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs-creator', week, year, platform], queryFn: () => getJobs({ week, year, ...(platform !== 'Alle' && { platform }) }) })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt"   value={summary?.total}  color="gray" />
        <StatCard label="Offen"    value={summary?.open}   color="red" />
        <StatCard label="Erledigt" value={summary?.confirmed} color="green" />
      </div>
      <PlatformFilter value={platform} onChange={setPlatform} />
      {isLoading ? (
        <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🌸</div>
          <p className="text-gray-400 text-sm">Keine Jobs für KW{week}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(j => (
            <div key={j.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-500 uppercase">{j.platform}</span>
                {j.source_link && <a href={j.source_link} target="_blank" rel="noreferrer" className="ml-2 text-xs text-violet-600 hover:underline">Beispiel</a>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[j.status]}`}>{STATUS_LABELS[j.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_CYCLE = ['idea', 'planned', 'filming', 'done']

function nextWeekOf(week, year) {
  if (week >= 52) return { week: 1, year: year + 1 }
  return { week: week + 1, year }
}

// ── Inline-Formular (Neu + Bearbeiten) ──────────────────────
function PlanForm({ initial, onSave, onCancel, isPending }) {
  const [f, setF] = useState(initial)
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {['IG', 'TK', 'OF', 'FL', 'ML'].map(p => (
          <button key={p} type="button" onClick={() => setF(x => ({ ...x, platform: p }))}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${f.platform === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            {p}
          </button>
        ))}
      </div>
      <input
        value={f.title || ''} onChange={e => setF(x => ({ ...x, title: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Titel…"
      />
      <textarea
        rows={2} value={f.description || ''} onChange={e => setF(x => ({ ...x, description: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Beschreibung…"
      />
      <div className="flex items-center gap-3">
        <select value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="idea">Idee</option>
          <option value="planned">Geplant</option>
          <option value="filming">Am Filmen</option>
          <option value="done">Fertig</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={f.visible_to_agency} onChange={e => setF(x => ({ ...x, visible_to_agency: e.target.checked }))} className="rounded" />
          Agentur sichtbar
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">Abbrechen</button>
        <button onClick={() => onSave(f)} disabled={isPending}
          className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ── Mein Content Tab ─────────────────────────────────────────
function MeinContentTab({ week, year }) {
  const qc = useQueryClient()
  const [platform, setPlatform] = useState('Alle')
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState(null)

  const EMPTY = { platform: 'IG', title: '', description: '', status: 'idea', visible_to_agency: false }

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans-creator', week, year, platform],
    queryFn: () => getContentPlans({ week, year, ...(platform !== 'Alle' && { platform }) })
  })

  const gesamt   = plans.length
  const offen    = plans.filter(p => p.status !== 'done').length
  const erledigt = plans.filter(p => p.status === 'done').length

  const createMut = useMutation({
    mutationFn: data => createContentPlan({ ...data, week_number: week, year }),
    onSuccess: () => { qc.invalidateQueries(['plans-creator']); setShowNew(false) }
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateContentPlan(id, data),
    onSuccess: () => { qc.invalidateQueries(['plans-creator']); setEditId(null) }
  })

  const deleteMut = useMutation({
    mutationFn: deleteContentPlan,
    onSuccess: () => qc.invalidateQueries(['plans-creator'])
  })

  function cycleStatus(p) {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status) + 1) % STATUS_CYCLE.length]
    updateMut.mutate({ id: p.id, status: next })
  }

  async function pushToNextWeek(p) {
    const { week: nw, year: ny } = nextWeekOf(week, year)
    // Neuen Eintrag erstellen mit Referenz auf Original
    await createContentPlan({
      platform: p.platform,
      title: p.title,
      description: p.description,
      status: 'idea',
      visible_to_agency: p.visible_to_agency,
      week_number: nw,
      year: ny,
      carried_over_from: p.id,
    })
    // Original als "geschoben" markieren
    await updateContentPlan(p.id, { pushed_to_week: nw, pushed_to_year: ny })
    qc.invalidateQueries(['plans-creator'])
  }

  const nxt = nextWeekOf(week, year)

  return (
    <div className="space-y-5">
      {/* Stat-Karten */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt"   value={gesamt}   color="gray" />
        <StatCard label="Offen"    value={offen}    color="red" />
        <StatCard label="Erledigt" value={erledigt} color="green" />
      </div>

      {/* Plattform-Filter */}
      <div className="flex gap-2 flex-wrap">
        {['Alle', 'IG', 'TK', 'OF', 'FL', 'ML'].map(p => (
          <button key={p} onClick={() => setPlatform(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${platform === p ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Neuer Plan Button / Formular */}
      {showNew ? (
        <div className="bg-white rounded-xl border border-indigo-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Neuer Content-Plan</p>
          <PlanForm
            initial={EMPTY}
            onSave={f => createMut.mutate(f)}
            onCancel={() => setShowNew(false)}
            isPending={createMut.isPending}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="w-full py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-500 text-sm font-medium hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
        >
          + Neuer Content-Plan
        </button>
      )}

      {/* Pläne Liste */}
      {isLoading ? (
        <p className="text-center text-gray-400 text-sm py-8">Lädt…</p>
      ) : plans.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-gray-400 text-sm">Keine Pläne für KW{week}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p, idx) => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 space-y-3 transition-opacity ${
              p.status === 'done' ? 'border-green-200 opacity-75' :
              p.carried_over_from ? 'border-amber-200' :
              'border-gray-200'
            }`}>
              {/* Übertrag-Banner */}
              {p.carried_over_from && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 -mb-1">
                  <span>↩</span>
                  <span className="font-medium">Übertrag aus vorheriger Woche</span>
                </div>
              )}

              {editId === p.id ? (
                /* Bearbeitungs-Formular inline */
                <PlanForm
                  initial={{ platform: p.platform, title: p.title || '', description: p.description || '', status: p.status, visible_to_agency: p.visible_to_agency }}
                  onSave={f => updateMut.mutate({ id: p.id, ...f })}
                  onCancel={() => setEditId(null)}
                  isPending={updateMut.isPending}
                />
              ) : (
                <>
                  {/* Kopfzeile */}
                  <div className="flex items-start gap-3">
                    {/* Nummer + Checkbox */}
                    <label className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer pt-0.5">
                      <span className="text-xs font-bold text-gray-300 leading-none">{idx + 1}</span>
                      <input
                        type="checkbox"
                        checked={p.status === 'done'}
                        onChange={() => updateMut.mutate({ id: p.id, status: p.status === 'done' ? 'idea' : 'done' })}
                        className="w-4 h-4 rounded accent-green-500 cursor-pointer"
                      />
                    </label>

                    {/* Inhalt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">{p.platform}</span>
                        {p.pushed_to_week && (
                          <span className="text-xs text-indigo-400 font-medium">→ KW{p.pushed_to_week} geschoben</span>
                        )}
                      </div>
                      {p.title && (
                        <p className={`text-sm font-semibold mt-0.5 ${p.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {p.title}
                        </p>
                      )}
                      {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>

                    {/* Status-Badge */}
                    <button
                      onClick={() => cycleStatus(p)}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium hover:opacity-80 ${PLAN_COLORS[p.status]}`}
                    >
                      {PLAN_STATUS[p.status]}
                    </button>
                  </div>

                  {/* Aktionszeile */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 pl-7">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={p.visible_to_agency}
                        onChange={e => updateMut.mutate({ id: p.id, visible_to_agency: e.target.checked })}
                        className="rounded"
                      />
                      Agentur sichtbar
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditId(p.id)} className="text-xs text-gray-400 hover:text-gray-700">Bearbeiten</button>
                      {!p.pushed_to_week && (
                        <button
                          onClick={() => pushToNextWeek(p)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                        >
                          → KW{nxt.week}
                        </button>
                      )}
                      <button onClick={() => deleteMut.mutate(p.id)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Statistik Tab ────────────────────────────────────────────
const PERIOD_LABELS = { month: 'Monat', quarter: 'Quartal', half: 'Halbjahr', year: 'Jahr' }
const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function Bar({ value, max, color = 'bg-indigo-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{value}</span>
    </div>
  )
}

function StatistikTab({ week, year }) {
  const [period, setPeriod] = useState('month')
  const [platform, setPlatform] = useState('Alle')

  const pf = platform !== 'Alle' ? platform : undefined

  const { data: summary } = useQuery({
    queryKey: ['summary-creator', week, year],
    queryFn: () => getJobSummary({ week, year })
  })
  const { data: weekJobs = [] } = useQuery({
    queryKey: ['jobs-creator', week, year, 'Alle'],
    queryFn: () => getJobs({ week, year })
  })
  const { data: stats } = useQuery({
    queryKey: ['stats-creator', pf],
    queryFn: () => getJobStats({ platform: pf })
  })

  const periodValue = stats ? (stats[`${period}_count`] ?? 0) : null
  const maxPlatform = stats?.by_platform?.length > 0 ? Math.max(...stats.by_platform.map(p => p.count)) : 1
  const maxMonth    = stats?.by_month?.length    > 0 ? Math.max(...stats.by_month.map(m => m.count))    : 1

  const platformColors = { IG:'bg-pink-400', TK:'bg-gray-800', OF:'bg-blue-500', FL:'bg-green-500', ML:'bg-purple-500', OTHER:'bg-gray-400' }

  return (
    <div className="space-y-6">

      {/* ── Wochenübersicht ─────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">KW {week} · {year}</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Gesamt"   value={summary?.total}       color="gray" />
          <StatCard label="Offen"    value={summary?.open}        color="red" />
          <StatCard label="Erledigt" value={summary?.confirmed}   color="green" />
        </div>
        {weekJobs.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {weekJobs.map(j => (
              <div key={j.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-8">{j.platform}</span>
                  {j.source_link && <a href={j.source_link} target="_blank" rel="noreferrer" className="text-xs text-violet-500 hover:underline truncate max-w-[120px]">Link</a>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[j.status]}`}>{STATUS_LABELS[j.status]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-xs py-4">Keine Jobs diese Woche</p>
        )}
      </div>

      {/* ── Zeitraum-Statistik ───────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Zeitraum</p>

        {/* Platform-Filter */}
        <div className="flex gap-2 flex-wrap mb-4">
          {['Alle','IG','TK','OF','FL','ML'].map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${platform === p ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Zeitraum-Auswahl + Zahl */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`rounded-xl p-3 text-center border transition-all ${period === key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              <div className={`text-2xl font-bold ${period === key ? 'text-white' : 'text-gray-900'}`}>
                {stats ? (stats[`${key}_count`] ?? 0) : '–'}
              </div>
              <div className={`text-xs mt-0.5 ${period === key ? 'text-indigo-100' : 'text-gray-400'}`}>{label}</div>
            </button>
          ))}
        </div>

        {/* Plattform-Verteilung (Jahresbasis) */}
        {stats?.by_platform?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plattformen · {new Date().getFullYear()}</p>
            {stats.by_platform.map(p => (
              <div key={p.platform}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="font-medium">{p.platform}</span>
                </div>
                <Bar value={p.count} max={maxPlatform} color={platformColors[p.platform] || 'bg-indigo-400'} />
              </div>
            ))}
          </div>
        )}

        {/* Monatsverlauf */}
        {stats?.by_month?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Monatsverlauf · {new Date().getFullYear()}</p>
            {stats.by_month.map(m => {
              const monthIdx = parseInt(m.month.split('-')[1]) - 1
              return (
                <div key={m.month}>
                  <div className="text-xs text-gray-500 mb-1">{MONTH_NAMES[monthIdx]}</div>
                  <Bar value={m.count} max={maxMonth} />
                </div>
              )
            })}
          </div>
        )}

        {!stats && <p className="text-center text-gray-400 text-sm py-8">Lädt…</p>}
        {stats && stats.year_count === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-gray-400 text-sm">Noch keine Daten für {new Date().getFullYear()}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hauptkomponente ──────────────────────────────────────────
export default function CreatorDashboard() {
  const navigate = useNavigate()
  const { week: cw, year: cy } = getCurrentWeek()
  const [week, setWeek] = useState(cw)
  const [year, setYear] = useState(cy)
  const [activeTab, setActiveTab] = useState('Aufträge')

  async function handleLogout() {
    await logout()
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mit eingebetteten Tab-Buttons */}
      <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">CF</span>
            </div>
            <div>
              <div className="font-bold text-base leading-none">CreatorFlow</div>
              <div className="text-xs text-white/70 mt-0.5">KW {week}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WeekNav week={week} year={year} onChange={(w,y) => { setWeek(w); setYear(y) }} />
            <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">Abmelden</button>
          </div>
        </div>
        {/* Pill-Tabs */}
        <div className="max-w-2xl mx-auto mt-4 flex gap-2">
          {['Aufträge','Mein Content','Statistik'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${activeTab===t ? 'bg-white text-violet-700' : 'text-white/80 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {activeTab === 'Aufträge'    && <AuftraegeTab week={week} year={year} />}
        {activeTab === 'Mein Content' && <MeinContentTab week={week} year={year} />}
        {activeTab === 'Statistik'   && <StatistikTab week={week} year={year} />}
      </div>
    </div>
  )
}
