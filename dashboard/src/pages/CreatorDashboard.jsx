import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getJobStats, getContentPlanStats, getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan, getCreators, getMyProfile, getChangeRequests, createChangeRequest, updateMyPhoto } from '../lib/api.js'
import { clearAuth, getRole } from '../lib/auth.js'
import StatCard from '../components/StatCard.jsx'
import PlatformFilter from '../components/PlatformFilter.jsx'
import PlatformIcon from '../components/PlatformIcon.jsx'
import WeekNav from '../components/WeekNav.jsx'
import MalaraLogo from '../components/MalaraLogo.jsx'

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
const PLAN_STATUS = { idea:'Idee', planned:'Geplant', filming:'Am Filmen', editing:'Geschnitten', done:'Fertig' }
const PLAN_COLORS = { idea:'bg-gray-100 text-gray-600', planned:'bg-blue-100 text-blue-700', filming:'bg-orange-100 text-orange-700', editing:'bg-purple-100 text-purple-700', done:'bg-green-100 text-green-700' }
const PLAN_DOT    = { idea:'bg-gray-400', planned:'bg-blue-500', filming:'bg-orange-500', editing:'bg-purple-500', done:'bg-green-500' }

// ── Gradient Header ─────────────────────────────────────────
function CreatorHeader({ tab, week, year, onWeekChange, onLogout }) {
  return (
    <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white px-6 pb-4 sticky top-0 z-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
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
              <div className="flex items-center gap-2">
                <PlatformIcon platform={j.platform} size="sm" />
                {j.source_link && <a href={j.source_link} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline">Beispiel</a>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[j.status]}`}>{STATUS_LABELS[j.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_CYCLE_WEEK = ['planned', 'filming', 'editing', 'done']

function nextWeekOf(week, year) {
  if (week >= 52) return { week: 1, year: year + 1 }
  return { week: week + 1, year }
}

// ISO-Woche → 7 Datumsobjekte (Mo–So)
function getWeekDates(week, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d
  })
}

const MONTH_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const DAY_SHORT   = ['Mo','Di','Mi','Do','Fr','Sa','So']

// ── Video-Embed-Helper ───────────────────────────────────────
function getEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    // Instagram post / reel / tv
    if (u.hostname.includes('instagram.com')) {
      const m = u.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)
      if (m) return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`
    }
    // TikTok
    if (u.hostname.includes('tiktok.com')) {
      const m = u.pathname.match(/\/video\/(\d+)/)
      if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`
    }
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch {}
  return null
}

// ── Video-Popup ──────────────────────────────────────────────
function VideoModal({ url, onClose }) {
  const embedUrl = getEmbedUrl(url)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm overflow-hidden shadow-2xl"
           style={{ maxHeight: '90dvh' }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Vorschau</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Embed iframe */}
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full border-0"
            style={{ height: '560px' }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="px-6 py-10 text-center space-y-3">
            <p className="text-gray-500 text-sm">Vorschau nicht verfügbar für diesen Link.</p>
            <a href={url} target="_blank" rel="noreferrer"
              className="inline-block px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-full hover:bg-violet-700">
              Im Browser öffnen ↗
            </a>
          </div>
        )}

        {/* Footer */}
        {embedUrl && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <a href={url} target="_blank" rel="noreferrer"
              className="text-xs text-gray-400 hover:text-violet-600 transition-colors">
              Im Browser öffnen ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit-Popup ───────────────────────────────────────────────
function EditPlanModal({ plan, onClose, onSave, isPending }) {
  const role = getRole()
  const [f, setF] = useState({
    platform:         plan.platform,
    title:            plan.title || '',
    description:      plan.description || '',
    source_link:      plan.source_link || '',
    status:           plan.status,
    visible_to_agency: plan.visible_to_agency,
    partner_type:     plan.partner_type || 'solo',
    posting_day:      plan.posting_day ?? null,
    posting_time:     plan.posting_time ? plan.posting_time.slice(0, 5) : '',
    creator_id:       plan.creator_id,
  })

  const { data: creators = [] } = useQuery({
    queryKey: ['creators-list'],
    queryFn:  () => getCreators(),
    enabled:  role === 'admin' || role === 'agency',
  })

  function handleSave() {
    const data = {
      ...f,
      title:       f.title       || null,
      description: f.description || null,
      source_link: f.source_link || null,
      posting_time: f.posting_time || null,
    }
    onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-safe"
         onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto"
           style={{ maxHeight: '92dvh' }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-bold text-gray-800">Plan bearbeiten</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Plattform */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Plattform</label>
            <div className="flex gap-2 flex-wrap">
              {['IG','TK','OF','FL','ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="sm" active={f.platform === p}
                  onClick={() => setF(x => ({ ...x, platform: p }))} />
              ))}
            </div>
          </div>

          {/* Solo / Partner */}
          <div className="flex gap-2">
            {[['solo','👤 Solo'],['partner','👥 Partner']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setF(x => ({ ...x, partner_type: val }))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${f.partner_type === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Titel */}
          <input value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Titel…" />

          {/* Beschreibung */}
          <textarea rows={2} value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Beschreibung…" />

          {/* Beispiel-Link */}
          <input type="url" value={f.source_link} onChange={e => setF(x => ({ ...x, source_link: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Beispiel-Link (https://…)" />

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PLAN_STATUS).filter(([k]) => k !== 'idea').map(([val, label]) => (
                <button key={val} type="button" onClick={() => setF(x => ({ ...x, status: val }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${f.status === val ? PLAN_COLORS[val] + ' border-transparent' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Posting-Tag */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Posting-Tag</label>
            <div className="flex gap-1">
              {DAY_SHORT.map((day, i) => (
                <button key={i} type="button"
                  onClick={() => setF(x => ({ ...x, posting_day: x.posting_day === i+1 ? null : i+1 }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${f.posting_day === i+1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Uhrzeit */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Uhrzeit</label>
            <input type="time" value={f.posting_time}
              onChange={e => setF(x => ({ ...x, posting_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {/* Agentur sichtbar */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={f.visible_to_agency}
              onChange={e => setF(x => ({ ...x, visible_to_agency: e.target.checked }))}
              className="rounded accent-violet-600" />
            Für Agentur sichtbar
          </label>

          {/* Creator-Selector (Admin / Agency) */}
          {(role === 'admin' || role === 'agency') && creators.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Account verschieben
              </label>
              <select value={f.creator_id || ''}
                onChange={e => setF(x => ({ ...x, creator_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                {creators.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.artist_name || c.real_name}
                    {c.artist_name && c.real_name ? ` (${c.real_name})` : ''}
                  </option>
                ))}
              </select>
              {f.creator_id !== plan.creator_id && (
                <p className="text-xs text-violet-600 mt-1 font-medium">↑ Plan wird zu diesem Account verschoben</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50">
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50">
            {isPending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline-Formular (Neu anlegen) ────────────────────────────
function PlanForm({ initial, onSave, onCancel, isPending, hideStatus }) {
  const [f, setF] = useState(initial)
  return (
    <div className="space-y-3">
      {/* Plattform */}
      <div className="flex gap-2 flex-wrap">
        {['IG', 'TK', 'OF', 'FL', 'ML'].map(p => (
          <PlatformIcon key={p} platform={p} size="sm" active={f.platform === p}
            onClick={() => setF(x => ({ ...x, platform: p }))} />
        ))}
      </div>
      {/* Solo / Partner */}
      <div className="flex gap-2">
        {[['solo','👤 Solo'],['partner','👥 Partner']].map(([val, label]) => (
          <button key={val} type="button" onClick={() => setF(x => ({ ...x, partner_type: val }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${f.partner_type === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            {label}
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
      <input
        type="url"
        value={f.source_link || ''} onChange={e => setF(x => ({ ...x, source_link: e.target.value || null }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Beispiel-Link (https://…)"
      />
      <div className="flex items-center gap-3">
        {!hideStatus && (
          <select value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="idea">Idee</option>
            <option value="planned">Geplant</option>
          </select>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={f.visible_to_agency} onChange={e => setF(x => ({ ...x, visible_to_agency: e.target.checked }))} className="rounded" />
          Agentur sichtbar
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">Abbrechen</button>
        <button onClick={() => onSave({ ...f, source_link: f.source_link || null })} disabled={isPending}
          className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ── Plan-Karte (wiederverwendet in Wochenplan + Ideen) ───────
function PlanCard({ p, idx, week, year, onEdit, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, showWeekBadge, isIdeaTab }) {
  const nxt = nextWeekOf(week, year)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const busy = busyId === p.id

  function cycleStatus() {
    const next = STATUS_CYCLE_WEEK[(STATUS_CYCLE_WEEK.indexOf(p.status) + 1) % STATUS_CYCLE_WEEK.length]
    updateMut.mutate({ id: p.id, status: next })
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${
      p.status === 'done' ? 'border-green-300 bg-green-100' :
      p.pushed_to_week ? 'border-orange-300 bg-orange-100 opacity-75' :
      'border-gray-200'
    }`}>
      {p.pushed_to_week && (
        <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-200/60 rounded-lg px-2.5 py-1.5 mb-3">
          <span>→</span><span className="font-medium">Verschoben nach KW{p.pushed_to_week}</span>
        </div>
      )}

      <>
          {/* ── Main row ───────────────────────────────── */}
          <div className="flex items-start gap-3">

            {/* Big round done-toggle */}
            <button
              onClick={() => !isIdeaTab && updateMut.mutate({ id: p.id, status: p.status === 'done' ? 'planned' : 'done' })}
              disabled={isIdeaTab || busy}
              className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 active:scale-95
                ${p.status === 'done'
                  ? 'bg-green-500 border-green-500 shadow-sm shadow-green-200'
                  : 'border-gray-300 hover:border-green-400 bg-white'}
                disabled:opacity-40`}
            >
              {p.status === 'done' && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <PlatformIcon platform={p.platform} size="badge" />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.partner_type === 'partner' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.partner_type === 'partner' ? '👥 Partner' : '👤 Solo'}
                </span>
                {showWeekBadge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-400 font-medium">KW{p.week_number}</span>
                )}
                {p.carried_over_from && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">↩ Übertrag</span>
                )}
              </div>
              {p.title && (
                <p className={`text-sm font-semibold mt-1 ${p.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {p.title}
                </p>
              )}
              {p.description && (
                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{p.description}</p>
              )}
              {p.source_link && (
                <button onClick={() => setShowPreview(true)}
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Beispielvideo ansehen
                </button>
              )}
              {showPreview && <VideoModal url={p.source_link} onClose={() => setShowPreview(false)} />}
            </div>

            {/* Right: status + push outlined pill */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {/* Status badge (cycles on tap) */}
              {!isIdeaTab && (
                <button onClick={cycleStatus} disabled={busy}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium hover:opacity-80 disabled:opacity-50 transition-opacity ${PLAN_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                  {updateMut.isPending && updateMut.variables?.id === p.id ? '…' : PLAN_STATUS[p.status] || p.status}
                </button>
              )}

              {/* Push / Einplanen / Rückgängig — outlined pill */}
              {isIdeaTab ? (
                <button
                  onClick={() => updateMut.mutate({ id: p.id, status: 'planned', week_number: week, year })}
                  disabled={busy}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border border-violet-400 text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {updateMut.isPending && updateMut.variables?.id === p.id ? '…' : `→ KW${week}`}
                </button>
              ) : p.pushed_to_week ? (
                <button onClick={() => undoPushMut.mutate({ id: p.id, allPlans })} disabled={undoPushMut?.isPending || busy}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-orange-400 text-orange-600 hover:bg-orange-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {undoPushMut?.isPending && undoPushMut.variables?.id === p.id ? '…' : '↩ Rückgängig'}
                </button>
              ) : (
                <button onClick={() => pushMut.mutate(p)} disabled={pushMut.isPending || busy}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-400 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {pushMut.isPending && pushMut.variables?.id === p.id ? '…' : `→ KW${nxt.week}`}
                </button>
              )}
            </div>
          </div>

          {/* ── Footer: agency toggle + edit + delete ─── */}
          <div className="mt-3 pt-2.5 border-t border-gray-100 pl-11 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={p.visible_to_agency}
                disabled={busy}
                onChange={e => updateMut.mutate({ id: p.id, visible_to_agency: e.target.checked })}
                className="rounded disabled:opacity-50 accent-violet-600"
              />
              Agentur sichtbar
            </label>

            <div className="flex items-center gap-1">
              {/* Edit */}
              <button onClick={() => onEdit(p)} disabled={busy}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                title="Bearbeiten">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* Delete / Confirm */}
              {confirmDel ? (
                <>
                  <button onClick={() => { deleteMut.mutate(p.id); setConfirmDel(false) }}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 font-bold px-2 py-1 rounded-lg transition-colors">
                    Ja
                  </button>
                  <button onClick={() => setConfirmDel(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(true)} disabled={busy}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  title="Löschen">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </>
    </div>
  )
}

// ── Mein Content Tab ─────────────────────────────────────────
function MeinContentTab({ week, year }) {
  const qc = useQueryClient()
  const [subTab, setSubTab]         = useState('woche')  // 'woche' | 'ideen'
  const [platform, setPlatform]     = useState('Alle')
  const [partnerFilter, setPartnerFilter] = useState('Alle')
  const [showNew, setShowNew]       = useState(false)
  const [editPlan, setEditPlan]     = useState(null)   // Plan-Objekt das bearbeitet wird
  const [statusFilter, setStatusFilter] = useState('Alle')

  const EMPTY_WEEK = { platform: 'IG', title: '', description: '', source_link: '', status: 'planned', visible_to_agency: false, partner_type: 'solo' }
  const EMPTY_IDEA = { platform: 'IG', title: '', description: '', source_link: '', status: 'idea',   visible_to_agency: false, partner_type: 'solo' }

  // Wochenplan: aktuelle KW
  const { data: weekRaw = [], isLoading: weekLoading, isError: weekError, error: weekErr } = useQuery({
    queryKey: ['plans-creator', week, year, platform],
    queryFn: () => getContentPlans({ week, year, ...(platform !== 'Alle' && { platform }) })
  })

  // Ideenspeicher: alle KWs, nur status='idea'
  const { data: allRaw = [], isLoading: ideasLoading } = useQuery({
    queryKey: ['plans-creator-ideas', platform],
    queryFn: () => getContentPlans({ ...(platform !== 'Alle' && { platform }) })
  })

  const applyPartner = list => partnerFilter === 'Alle' ? list : list.filter(p => p.partner_type === partnerFilter.toLowerCase())
  const applyStatus  = list => {
    if (statusFilter === 'planned')  return list.filter(p => p.status === 'planned')
    if (statusFilter === 'filming')  return list.filter(p => p.status === 'filming')
    if (statusFilter === 'editing')  return list.filter(p => p.status === 'editing')
    if (statusFilter === 'done')     return list.filter(p => p.status === 'done')
    if (statusFilter === 'pushed')   return list.filter(p => !!p.pushed_to_week)
    return list
  }

  // Wochenplan: nur geplant + fertig (Ideen gehören in den Ideenspeicher)
  const weekPlans  = applyStatus(applyPartner(weekRaw.filter(p => p.status !== 'idea')))
  const ideaPlans  = applyPartner(allRaw.filter(p => p.status === 'idea'))

  const plans      = subTab === 'woche' ? weekPlans : ideaPlans
  const isLoading  = subTab === 'woche' ? weekLoading : ideasLoading

  const invAll = () => {
    qc.invalidateQueries({ queryKey: ['plans-creator'] })
    qc.invalidateQueries({ queryKey: ['plans-creator-ideas'] })
  }

  const createMut = useMutation({
    mutationFn: data => createContentPlan({ ...data, week_number: week, year }),
    onSuccess: () => { invAll(); setShowNew(false) },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateContentPlan(id, data),
    onSuccess: () => { invAll(); setEditPlan(null) },
    onError: e => alert('Fehler beim Speichern: ' + (e.response?.data?.error || e.message))
  })

  const deleteMut = useMutation({
    mutationFn: id => deleteContentPlan(id),
    onSuccess: invAll,
    onError: e => alert('Fehler beim Löschen: ' + (e.response?.data?.error || e.message))
  })

  const pushMut = useMutation({
    mutationFn: async (p) => {
      const { week: nw, year: ny } = nextWeekOf(week, year)
      await createContentPlan({
        platform: p.platform, title: p.title, description: p.description,
        source_link: p.source_link || null,
        status: 'planned', visible_to_agency: p.visible_to_agency,
        partner_type: p.partner_type, week_number: nw, year: ny,
        carried_over_from: p.id,
      })
      await updateContentPlan(p.id, { pushed_to_week: nw, pushed_to_year: ny })
    },
    onSuccess: invAll,
    onError: e => alert('Fehler beim Schieben: ' + (e.response?.data?.error || e.message))
  })

  const undoPushMut = useMutation({
    mutationFn: async ({ id, allPlans }) => {
      const copy = allPlans.find(c => c.carried_over_from === id)
      if (copy) await deleteContentPlan(copy.id)
      await updateContentPlan(id, { pushed_to_week: null, pushed_to_year: null })
    },
    onSuccess: invAll,
    onError: e => alert('Fehler beim Rückgängig: ' + (e.response?.data?.error || e.message))
  })

  const busyId = (updateMut.isPending && updateMut.variables?.id)
    || (deleteMut.isPending && deleteMut.variables)
    || (pushMut.isPending && pushMut.variables?.id)
    || (undoPushMut.isPending && undoPushMut.variables?.id)

  const gesamt   = weekPlans.length
  const offen    = weekPlans.filter(p => ['planned','filming','editing'].includes(p.status)).length
  const erledigt = weekPlans.filter(p => p.status === 'done').length

  return (
    <div className="space-y-4">
      {/* Stat-Karten (immer KW-basiert) */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt"   value={gesamt}   color="gray" />
        <StatCard label="Offen"    value={offen}    color="red" />
        <StatCard label="Erledigt" value={erledigt} color="green" />
      </div>

      {/* Unterreiter */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[['woche',`📅 KW${week}`],['ideen','💡 Ideenspeicher']].map(([val, label]) => (
          <button key={val} onClick={() => { setSubTab(val); setShowNew(false); setEditPlan(null); setStatusFilter('Alle') }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${subTab === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filter — kompakt in einem Block */}
      <div className="space-y-2">
        <PlatformFilter value={platform} onChange={setPlatform} />
        <div className="flex flex-wrap gap-1.5 items-center">
          {[['Alle','Alle'],['solo','👤 Solo'],['partner','👥 Partner']].map(([val, label]) => (
            <button key={val} onClick={() => setPartnerFilter(val)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${partnerFilter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
          {subTab === 'woche' && (
            <>
              <span className="w-px h-3.5 bg-gray-200 flex-shrink-0" />
              {[['Alle','Alle'],['planned','Geplant'],['filming','Gefilmt'],['editing','Geschnitten'],['done','Fertig'],['pushed','Verschoben']].map(([val, label]) => (
                <button key={`s-${val}`} onClick={() => setStatusFilter(val)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${statusFilter === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Ideenspeicher-Hinweis */}
      {subTab === 'ideen' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-600">
          💡 Alle Ideen aus allen Wochen — zeitunabhängig speichern, später einplanen.
        </div>
      )}

      {/* Neuer Eintrag */}
      {showNew ? (
        <div className="bg-white rounded-xl border border-indigo-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {subTab === 'ideen' ? 'Neue Idee' : 'Neuer Plan'}
          </p>
          <PlanForm
            initial={subTab === 'ideen' ? EMPTY_IDEA : EMPTY_WEEK}
            onSave={f => createMut.mutate(f)}
            onCancel={() => setShowNew(false)}
            isPending={createMut.isPending}
            hideStatus={subTab === 'ideen'}
          />
        </div>
      ) : (
        <button onClick={() => setShowNew(true)}
          className="w-full py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-500 text-sm font-medium hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
          {subTab === 'ideen' ? '+ Neue Idee' : '+ Neuer Content-Plan'}
        </button>
      )}

      {/* Liste */}
      {weekError && subTab === 'woche' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Fehler: {weekErr?.response?.data?.detail || weekErr?.response?.data?.error || weekErr?.message}
        </div>
      ) : isLoading ? (
        <p className="text-center text-gray-400 text-sm py-8">Lädt…</p>
      ) : plans.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">{subTab === 'ideen' ? '💡' : '🎬'}</div>
          <p className="text-gray-400 text-sm">
            {subTab === 'ideen' ? 'Noch keine Ideen gespeichert' : `Keine Pläne für KW${week}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p, idx) => (
            <PlanCard
              key={p.id}
              p={p} idx={idx}
              week={week} year={year}
              onEdit={p => setEditPlan(p)}
              updateMut={updateMut} deleteMut={deleteMut} pushMut={pushMut} undoPushMut={undoPushMut}
              allPlans={allRaw}
              busyId={busyId}
              showWeekBadge={subTab === 'ideen'}
              isIdeaTab={subTab === 'ideen'}
            />
          ))}
        </div>
      )}

      {/* Edit-Modal */}
      {editPlan && (
        <EditPlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSave={f => updateMut.mutate({ id: editPlan.id, ...f })}
          isPending={updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Kalender Tab ─────────────────────────────────────────────
function KalenderTab({ week, year }) {
  const qc = useQueryClient()
  const [editPlan, setEditPlan] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data: allPlans = [], isLoading } = useQuery({
    queryKey: ['plans-calendar', week, year],
    queryFn:  () => getContentPlans({ week, year }),
  })

  const plans = allPlans.filter(p => p.status !== 'idea' && !p.deleted_at)
  const weekDates = getWeekDates(week, year)

  // Pläne nach Tag gruppieren
  const byDay = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, []]))
  const unscheduled = []
  for (const p of plans) {
    if (p.posting_day >= 1 && p.posting_day <= 7) byDay[p.posting_day].push(p)
    else unscheduled.push(p)
  }
  // Innerhalb jedes Tages nach Uhrzeit sortieren
  for (let d = 1; d <= 7; d++) {
    byDay[d].sort((a, b) => (a.posting_time || '99:99') > (b.posting_time || '99:99') ? 1 : -1)
  }

  const today = new Date()
  const isToday = (date) =>
    date.getUTCFullYear() === today.getFullYear() &&
    date.getUTCMonth()    === today.getMonth() &&
    date.getUTCDate()     === today.getDate()

  const invAll = () => qc.invalidateQueries({ queryKey: ['plans-calendar', week, year] })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateContentPlan(id, data),
    onSuccess: () => { invAll(); setEditPlan(null) },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })

  const selected = plans.find(p => p.id === selectedId)

  if (isLoading) return <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>

  return (
    <div className="space-y-4">
      {/* Datum-Leiste */}
      <div className="text-center text-xs text-gray-500 font-medium">
        {weekDates[0].getUTCDate()}. {MONTH_SHORT[weekDates[0].getUTCMonth()]} – {weekDates[6].getUTCDate()}. {MONTH_SHORT[weekDates[6].getUTCMonth()]}
      </div>

      {/* Kalender + Sidebar */}
      <div className="flex gap-3">

        {/* 7-Spalten-Raster */}
        <div className="flex-1 overflow-x-auto">
          <div className="grid grid-cols-7 gap-1.5 min-w-[420px]">
            {weekDates.map((date, i) => {
              const dayPlans = byDay[i + 1] || []
              const today_ = isToday(date)
              return (
                <div key={i} className={`rounded-xl border transition-all ${today_ ? 'bg-violet-600 border-violet-700' : 'bg-gray-50 border-gray-200'}`}>
                  {/* Tag-Header */}
                  <div className={`text-center px-1 pt-2 pb-1.5 ${today_ ? 'text-white' : 'text-gray-700'}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{DAY_SHORT[i]}</div>
                    <div className="text-xl font-bold leading-tight">{date.getUTCDate()}</div>
                    <div className="text-[10px] opacity-60">{MONTH_SHORT[date.getUTCMonth()]}</div>
                  </div>

                  {/* Plan-Karten */}
                  <div className="px-1 pb-2 space-y-1 min-h-[60px]">
                    {dayPlans.map(p => (
                      <button key={p.id}
                        onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                        className={`w-full text-left rounded-lg p-1.5 transition-all border ${selectedId === p.id ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-white border-gray-100 hover:border-violet-200'}`}>
                        {/* Uhrzeit groß */}
                        {p.posting_time && (
                          <div className="text-sm font-bold text-violet-600 leading-none mb-1">
                            {p.posting_time.slice(0, 5)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PLAN_DOT[p.status] || 'bg-gray-400'}`} />
                          <PlatformIcon platform={p.platform} size="badge" />
                        </div>
                        {p.title && (
                          <p className="text-[10px] text-gray-600 mt-0.5 truncate leading-snug">{p.title}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-44 flex-shrink-0">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PLAN_DOT[selected.status] || 'bg-gray-400'}`} />
                <PlatformIcon platform={selected.platform} size="badge" />
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[selected.status] || 'bg-gray-100 text-gray-600'}`}>
                  {PLAN_STATUS[selected.status] || selected.status}
                </span>
              </div>
              {selected.posting_time && (
                <div className="text-2xl font-bold text-violet-600 tracking-tight">
                  {selected.posting_time.slice(0, 5)}
                </div>
              )}
              {selected.title && (
                <p className="text-sm font-semibold text-gray-800">{selected.title}</p>
              )}
              {selected.description && (
                <p className="text-xs text-gray-500 whitespace-pre-wrap">{selected.description}</p>
              )}
              <button onClick={() => setEditPlan(selected)}
                className="w-full py-2 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors">
                Bearbeiten
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center space-y-2">
              <svg className="w-8 h-8 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs font-medium text-gray-500">Plan auswählen</p>
              <p className="text-[10px] text-gray-400">Klicke auf einen Plan im Kalender</p>
            </div>
          )}
        </div>
      </div>

      {/* Nicht eingeplant */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          Nicht eingeplant
        </div>
        {unscheduled.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-1">
            Alle Pläne haben einen Posting-Termin — Karte hierhin ziehen zum Entterminieren
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(p => (
              <button key={p.id}
                onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                className={`flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1.5 text-xs transition-all ${selectedId === p.id ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:border-violet-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PLAN_DOT[p.status] || 'bg-gray-400'}`} />
                <PlatformIcon platform={p.platform} size="badge" />
                <span className="text-gray-700 max-w-[80px] truncate">{p.title || 'Ohne Titel'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit-Modal */}
      {editPlan && (
        <EditPlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSave={f => updateMut.mutate({ id: editPlan.id, ...f })}
          isPending={updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Statistik Tab ────────────────────────────────────────────
const PERIOD_LABELS = { month: 'Monat', quarter: 'Quartal', half: 'Halbjahr', year: 'Jahr' }
const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const PLATFORM_COLORS = { IG:'bg-pink-400', TK:'bg-gray-800', OF:'bg-blue-500', FL:'bg-green-500', ML:'bg-purple-500', OTHER:'bg-gray-400' }

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

function StatsSection({ stats, period, setPeriod, platform, setPlatform }) {
  const maxPlatform = stats?.by_platform?.length > 0 ? Math.max(...stats.by_platform.map(p => p.count)) : 1
  const maxMonth    = stats?.by_month?.length    > 0 ? Math.max(...stats.by_month.map(m => m.count))    : 1

  return (
    <div className="space-y-4">
      {/* Plattform-Filter */}
      <PlatformFilter value={platform} onChange={setPlatform} />

      {/* Zeitraum-Karten */}
      <div className="grid grid-cols-4 gap-2">
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

      {/* Plattform-Verteilung */}
      {stats?.by_platform?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plattformen · {new Date().getFullYear()}</p>
          {stats.by_platform.map(p => (
            <div key={p.platform}>
              <div className="flex items-center gap-1.5 mb-1">
                <PlatformIcon platform={p.platform} size="badge" />
              </div>
              <Bar value={p.count} max={maxPlatform} color={PLATFORM_COLORS[p.platform] || 'bg-indigo-400'} />
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
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-gray-400 text-sm">Noch keine Daten für {new Date().getFullYear()}</p>
        </div>
      )}
    </div>
  )
}

function StatistikTab({ week, year }) {
  const [dataType, setDataType] = useState('jobs')   // 'jobs' | 'plans'
  const [period, setPeriod]     = useState('month')
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
  const { data: jobStats } = useQuery({
    queryKey: ['stats-jobs-creator', pf],
    queryFn: () => getJobStats({ platform: pf }),
    enabled: dataType === 'jobs'
  })
  const { data: planStats } = useQuery({
    queryKey: ['stats-plans-creator', pf],
    queryFn: () => getContentPlanStats({ platform: pf }),
    enabled: dataType === 'plans'
  })
  const { data: weekPlans = [] } = useQuery({
    queryKey: ['plans-week-stat', week, year],
    queryFn: () => getContentPlans({ week, year }),
    enabled: dataType === 'plans'
  })

  const activeStats = dataType === 'jobs' ? jobStats : planStats

  const kwGesamt   = dataType === 'jobs' ? (summary?.total     ?? 0) : weekPlans.filter(p => p.status !== 'idea').length
  const kwOffen    = dataType === 'jobs' ? (summary?.open      ?? 0) : weekPlans.filter(p => p.status === 'planned' || p.status === 'filming').length
  const kwErledigt = dataType === 'jobs' ? (summary?.confirmed ?? 0) : weekPlans.filter(p => p.status === 'done').length

  return (
    <div className="space-y-6">

      {/* ── Datentyp-Toggle — ganz oben ─────────────────── */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {[['jobs','📋 Aufträge'],['plans','🎬 Eigener Content']].map(([val, label]) => (
          <button key={val} onClick={() => { setDataType(val); setPlatform('Alle') }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${dataType === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Wochenübersicht ─────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">KW {week} · {year}</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Gesamt"   value={kwGesamt}   color="gray" />
          <StatCard label={dataType === 'jobs' ? 'Offen' : 'Geplant'} value={kwOffen}    color="red" />
          <StatCard label="Erledigt" value={kwErledigt} color="green" />
        </div>
        {dataType === 'jobs' ? (
          weekJobs.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {weekJobs.map(j => (
                <div key={j.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={j.platform} size="badge" />
                    {j.source_link && <a href={j.source_link} target="_blank" rel="noreferrer" className="text-xs text-violet-500 hover:underline truncate max-w-[120px]">Link</a>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[j.status]}`}>{STATUS_LABELS[j.status]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 text-xs py-4">Keine Aufträge diese Woche</p>
          )
        ) : (
          weekPlans.filter(p => p.status !== 'idea').length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {weekPlans.filter(p => p.status !== 'idea').map(p => (
                <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={p.platform} size="badge" />
                    <span className="text-xs text-gray-700 truncate max-w-[160px]">{p.title || '(kein Titel)'}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {PLAN_STATUS[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 text-xs py-4">Keine Content-Pläne diese Woche</p>
          )
        )}
      </div>

      {/* ── Zeitraum-Statistik ───────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Zeitraum</p>
        <StatsSection
          stats={activeStats}
          period={period}
          setPeriod={setPeriod}
          platform={platform}
          setPlatform={setPlatform}
        />
      </div>
    </div>
  )
}

// ── Bild-Resize Hilfsfunktion ────────────────────────────────
function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const FIELD_LABELS = { artist_name: 'Künstlername', photo_url: 'Foto', contact_email: 'E-Mail', phone: 'Telefon', platforms: 'Plattformen' }

// ── Profil Tab ───────────────────────────────────────────────
function ProfilTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(null)
  const [formErr, setFormErr] = useState('')
  const fileRef = useState(null)

  const { data: profile, isLoading } = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile })
  const { data: requests = [] } = useQuery({ queryKey: ['change-requests-creator'], queryFn: getChangeRequests })

  const hasPending = requests.some(r => r.status === 'pending')

  const photoMut = useMutation({
    mutationFn: updateMyPhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
    onError: e => alert('Foto-Upload fehlgeschlagen: ' + (e.response?.data?.error || e.message))
  })

  const requestMut = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests-creator'] }); setShowForm(false) },
    onError: e => setFormErr(e.response?.data?.error || 'Fehler beim Senden')
  })

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file, 400)
      photoMut.mutate(dataUrl)
    } catch {
      alert('Bild konnte nicht verarbeitet werden')
    }
  }

  function openForm() {
    if (!profile) return
    setForm({ artist_name: profile.artist_name || '', contact_email: profile.contact_email || '', phone: profile.phone || '', platforms: [...(profile.platforms || [])] })
    setFormErr('')
    setShowForm(true)
  }

  function submitRequest() {
    if (!form || !profile) return
    const fields = {}
    for (const key of ['artist_name', 'contact_email', 'phone']) {
      const newVal = form[key]
      const oldVal = profile[key] || ''
      if (newVal !== oldVal) fields[key] = { old: oldVal, new: newVal }
    }
    const oldPl = [...(profile.platforms || [])].sort().join(',')
    const newPl = [...form.platforms].sort().join(',')
    if (oldPl !== newPl) fields.platforms = { old: profile.platforms || [], new: form.platforms }
    if (Object.keys(fields).length === 0) { setFormErr('Keine Änderungen erkannt'); return }
    requestMut.mutate({ fields })
  }

  if (isLoading) return <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
  if (!profile) return <p className="text-center text-gray-400 text-sm py-12">Profil nicht gefunden</p>

  return (
    <div className="space-y-4">
      {/* Profil-Karte */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {/* Avatar + Upload */}
        <div className="flex items-center gap-4 mb-5">
          <label className="relative cursor-pointer group flex-shrink-0">
            {profile.photo_url
              ? <img src={profile.photo_url} className="w-20 h-20 rounded-full object-cover" alt="" />
              : <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-2xl">
                  {(profile.artist_name || '?')[0].toUpperCase()}
                </div>
            }
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {photoMut.isPending
                ? <span className="text-white text-xs">…</span>
                : <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              }
            </div>
            <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoUpload} disabled={photoMut.isPending} />
          </label>
          <div>
            <p className="font-bold text-gray-900 text-xl leading-tight">{profile.artist_name || '(kein Künstlername)'}</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {profile.platforms?.map(p => <PlatformIcon key={p} platform={p} size="badge" />)}
            </div>
          </div>
        </div>

        {/* Felder */}
        <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
          {profile.contact_email && (
            <div className="flex items-center gap-3 text-gray-600">
              <span className="text-gray-400 text-xs w-16 flex-shrink-0">E-Mail</span>
              <span>{profile.contact_email}</span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-3 text-gray-600">
              <span className="text-gray-400 text-xs w-16 flex-shrink-0">Telefon</span>
              <span>{profile.phone}</span>
            </div>
          )}
          {!profile.contact_email && !profile.phone && (
            <p className="text-xs text-gray-400">Noch keine Kontaktdaten hinterlegt</p>
          )}
        </div>

        {/* Änderung beantragen */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {hasPending ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
              ⏳ Änderungsanfrage wird geprüft
            </div>
          ) : (
            <button onClick={openForm}
              className="w-full py-2.5 border-2 border-dashed border-violet-300 rounded-xl text-violet-600 text-sm font-medium hover:bg-violet-50 transition-colors">
              ✏️ Änderung beantragen
            </button>
          )}
        </div>
      </div>

      {/* Änderungsformular */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Änderung beantragen</p>
            <p className="text-xs text-gray-400 mt-0.5">Nur geänderte Felder werden eingereicht.</p>
          </div>
          <div className="space-y-3">
            {[['artist_name','Künstlername','text'],['contact_email','E-Mail','email'],['phone','Telefon','tel']].map(([key, label, type]) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                <input type={type} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Plattformen</label>
              <div className="flex gap-2 flex-wrap">
                {['IG','TK','OF','FL','ML'].map(p => (
                  <PlatformIcon key={p} platform={p} size="sm" active={form.platforms.includes(p)}
                    onClick={() => setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))} />
                ))}
              </div>
            </div>
          </div>
          {formErr && <p className="text-xs text-red-600">{formErr}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setFormErr('') }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              Abbrechen
            </button>
            <button onClick={submitRequest} disabled={requestMut.isPending}
              className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50">
              {requestMut.isPending ? 'Wird gesendet…' : 'Anfrage senden'}
            </button>
          </div>
        </div>
      )}

      {/* Anfrage-Verlauf */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Anfragen</p>
          {requests.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.status === 'pending' ? 'border-amber-200' : r.status === 'approved' ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' : r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.status === 'pending' ? '⏳ Ausstehend' : r.status === 'approved' ? '✅ Genehmigt' : '❌ Abgelehnt'}
                </span>
                <span className="text-xs text-gray-400">{new Date(r.requested_at).toLocaleDateString('de')}</span>
              </div>
              <div className="space-y-1">
                {Object.entries(r.fields).map(([key, val]) => (
                  <div key={key} className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">{FIELD_LABELS[key] || key}:</span>{' '}
                    <span className="text-gray-400 line-through">{Array.isArray(val.old) ? val.old.join(', ') : (val.old || '–')}</span>
                    {' → '}
                    <span className="text-gray-900 font-medium">{Array.isArray(val.new) ? val.new.join(', ') : (val.new || '–')}</span>
                  </div>
                ))}
              </div>
              {r.note && r.status === 'rejected' && (
                <p className="text-xs text-red-600 mt-2 italic">Grund: {r.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente ──────────────────────────────────────────
export default function CreatorDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { week: cw, year: cy } = getCurrentWeek()
  const [week, setWeek] = useState(cw)
  const [year, setYear] = useState(cy)
  const [activeTab, setActiveTab] = useState('Aufträge')

  // Alle Tab-Daten sofort beim Login parallel vorladen
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ['summary-creator', week, year],    queryFn: () => getJobSummary({ week, year }) })
    qc.prefetchQuery({ queryKey: ['jobs-creator', week, year, 'Alle'], queryFn: () => getJobs({ week, year }) })
    qc.prefetchQuery({ queryKey: ['plans-creator', week, year, 'Alle'], queryFn: () => getContentPlans({ week, year }) })
    qc.prefetchQuery({ queryKey: ['plans-creator-ideas', 'Alle'],    queryFn: () => getContentPlans({}) })
    qc.prefetchQuery({ queryKey: ['stats-jobs-creator', undefined],  queryFn: () => getJobStats() })
    qc.prefetchQuery({ queryKey: ['stats-plans-creator', undefined], queryFn: () => getContentPlanStats() })
  }, [week, year]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await logout()
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mit eingebetteten Tab-Buttons */}
      <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white px-6 pb-4 sticky top-0 z-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex flex-col">
            <MalaraLogo height={28} variant="white" />
            <div className="text-xs text-white/70 mt-0.5 pl-0.5">KW {week}</div>
          </div>
          <div className="flex items-center gap-3">
            <WeekNav week={week} year={year} onChange={(w,y) => { setWeek(w); setYear(y) }} />
            <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">Abmelden</button>
          </div>
        </div>
        {/* Pill-Tabs */}
        <div className="max-w-2xl mx-auto mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
          {['Aufträge','Mein Content','Kalender','Profil','Statistik'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeTab===t ? 'bg-white text-violet-700' : 'text-white/80 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Kalender' ? (
        <div className="px-4 py-5">
          <KalenderTab week={week} year={year} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-6 py-6">
          {activeTab === 'Aufträge'     && <AuftraegeTab week={week} year={year} />}
          {activeTab === 'Mein Content' && <MeinContentTab week={week} year={year} />}
          {activeTab === 'Profil'       && <ProfilTab />}
          {activeTab === 'Statistik'    && <StatistikTab week={week} year={year} />}
        </div>
      )}
    </div>
  )
}
