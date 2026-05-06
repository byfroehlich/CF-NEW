import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getJobStats, getContentPlanStats, getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan, getMyProfile, getChangeRequests, createChangeRequest, uploadFile, getCreatorPhotos, addCreatorPhoto, deleteCreatorPhoto, getCreatorAccounts, createCreatorAccount, updateCreatorAccount, deleteCreatorAccount } from '../lib/api.js'
import { clearAuth } from '../lib/auth.js'
import StatCard from '../components/StatCard.jsx'
import PlatformFilter from '../components/PlatformFilter.jsx'
import PlatformIcon from '../components/PlatformIcon.jsx'
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

const STATUS_CYCLE_WEEK = ['planned', 'done']  // Wochenplan: nur geplant ↔ fertig

function nextWeekOf(week, year) {
  if (week >= 52) return { week: 1, year: year + 1 }
  return { week: week + 1, year }
}

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

// ── Inline-Formular (Neu + Bearbeiten) ──────────────────────
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
      <input
        value={f.requisiten || ''} onChange={e => setF(x => ({ ...x, requisiten: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Requisiten…"
      />
      <input
        value={f.kleidung || ''} onChange={e => setF(x => ({ ...x, kleidung: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Kleidung…"
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
function PlanCard({ p, idx, week, year, editId, setEditId, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, showWeekBadge, isIdeaTab, isTopTab, accounts }) {
  const nxt = nextWeekOf(week, year)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const busy = busyId === p.id
  const accountName = accounts?.find(a => a.id === p.account_id)?.name

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

      {editId === p.id ? (
        <PlanForm
          initial={{ platform: p.platform, title: p.title || '', description: p.description || '', source_link: p.source_link || '', status: p.status, visible_to_agency: p.visible_to_agency, partner_type: p.partner_type || 'solo', requisiten: p.requisiten || '', kleidung: p.kleidung || '' }}
          onSave={f => updateMut.mutate({ id: p.id, ...f })}
          onCancel={() => setEditId(null)}
          isPending={updateMut.isPending}
        />
      ) : (
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
                {accountName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">{accountName}</span>
                )}
                {showWeekBadge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-400 font-medium">KW{p.week_number}</span>
                )}
                {p.carried_over_from && !isTopTab && (
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
              {(p.requisiten || p.kleidung) && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {p.requisiten && <span className="text-xs text-gray-400"><span className="font-medium text-gray-500">Requisiten:</span> {p.requisiten}</span>}
                  {p.kleidung && <span className="text-xs text-gray-400"><span className="font-medium text-gray-500">Kleidung:</span> {p.kleidung}</span>}
                </div>
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
              {/* Star / Top-Video */}
              <button onClick={() => updateMut.mutate({ id: p.id, is_top_video: !p.is_top_video })} disabled={busy}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${p.is_top_video ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-50'}`}
                title={p.is_top_video ? 'Top-Video entfernen' : 'Als Top-Video markieren'}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={p.is_top_video ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
              </button>
              {/* Edit */}
              <button onClick={() => setEditId(p.id)} disabled={busy}
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
      )}
    </div>
  )
}

// ── Plan List Row (kompakte Listenansicht) ───────────────────
function PlanListRow({ p, isIdeaTab, isTopTab, busy, updateMut, onClick, accounts }) {
  return (
    <div onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none ${
        p.status === 'done'    ? 'bg-green-50 border border-green-200' :
        p.pushed_to_week       ? 'bg-orange-50 border border-orange-200 opacity-75' :
        'bg-white border border-gray-200 active:bg-gray-50'
      }`}>
      {/* Fertig-Toggle */}
      {!isIdeaTab && (
        <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: p.id, status: p.status === 'done' ? 'planned' : 'done' }) }}
          disabled={busy}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all active:scale-95
            ${p.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400 bg-white'} disabled:opacity-40`}>
          {p.status === 'done' && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </button>
      )}
      {/* Plattform */}
      <PlatformIcon platform={p.platform} size="badge" />
      {/* Solo/Partner */}
      <span className="text-sm flex-shrink-0">{p.partner_type === 'partner' ? '👥' : '👤'}</span>
      {/* Account */}
      {accounts?.find(a => a.id === p.account_id) && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium flex-shrink-0 max-w-[80px] truncate">
          {accounts.find(a => a.id === p.account_id).name}
        </span>
      )}
      {/* Titel */}
      <span className={`flex-1 text-sm truncate ${p.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {p.title || p.description || <span className="text-gray-300 italic text-xs">Kein Titel</span>}
      </span>
      {/* Mini-Badges */}
      {p.pushed_to_week && <span className="text-xs text-orange-500 font-medium flex-shrink-0">→KW{p.pushed_to_week}</span>}
      {p.carried_over_from && !isTopTab && <span className="text-xs text-amber-600 flex-shrink-0">↩</span>}
      {p.is_top_video && <span className="text-yellow-500 flex-shrink-0 text-sm">⭐</span>}
      {/* Chevron */}
      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  )
}

// ── Plan Detail Modal ────────────────────────────────────────
function PlanDetailModal({ p, week, year, onClose, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, isIdeaTab }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const nxt = nextWeekOf(week, year)
  const busy = busyId === p.id

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto"
           style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformIcon platform={p.platform} size="badge" />
            <span className="text-xs font-medium text-gray-500">{p.partner_type === 'partner' ? '👥 Partner' : '👤 Solo'}</span>
            {p.carried_over_from && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">↩ Übertrag</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {editing ? (
            <PlanForm
              initial={{ platform: p.platform, title: p.title || '', description: p.description || '', source_link: p.source_link || '', status: p.status, visible_to_agency: p.visible_to_agency, partner_type: p.partner_type || 'solo', requisiten: p.requisiten || '', kleidung: p.kleidung || '' }}
              onSave={f => { updateMut.mutate({ id: p.id, ...f }); setEditing(false) }}
              onCancel={() => setEditing(false)}
              isPending={updateMut.isPending}
            />
          ) : (
            <>
              {p.pushed_to_week && (
                <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <span>→</span><span>Verschoben nach KW{p.pushed_to_week}</span>
                </div>
              )}
              {p.title && <h3 className={`text-base font-semibold ${p.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{p.title}</h3>}
              {p.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{p.description}</p>}
              {(p.requisiten || p.kleidung) && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                  {p.requisiten && (
                    <div className="text-sm"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">Requisiten</span>{p.requisiten}</div>
                  )}
                  {p.kleidung && (
                    <div className="text-sm"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">Kleidung</span>{p.kleidung}</div>
                  )}
                </div>
              )}
              {p.source_link && (
                <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Beispielvideo ansehen
                </button>
              )}
              {showPreview && <VideoModal url={p.source_link} onClose={() => setShowPreview(false)} />}

              {/* Aktionen */}
              <div className="space-y-2 pt-1">
                {!isIdeaTab && (
                  <button onClick={() => updateMut.mutate({ id: p.id, status: p.status === 'done' ? 'planned' : 'done' })} disabled={busy}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${p.status === 'done' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                    {p.status === 'done' ? '↩ Als offen markieren' : '✓ Als fertig markieren'}
                  </button>
                )}
                {isIdeaTab ? (
                  <button onClick={() => { updateMut.mutate({ id: p.id, status: 'planned', week_number: week, year }); onClose() }} disabled={busy}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold border border-violet-400 text-violet-600 hover:bg-violet-50 disabled:opacity-50">
                    → KW{week} einplanen
                  </button>
                ) : p.pushed_to_week ? (
                  <button onClick={() => { undoPushMut.mutate({ id: p.id, allPlans }); onClose() }} disabled={busy}
                    className="w-full py-2.5 rounded-xl text-sm font-medium border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50">
                    ↩ Schieben rückgängig
                  </button>
                ) : (
                  <button onClick={() => { pushMut.mutate(p); onClose() }} disabled={busy}
                    className="w-full py-2.5 rounded-xl text-sm font-medium border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                    → KW{nxt.week} schieben
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={p.visible_to_agency} disabled={busy}
                    onChange={e => updateMut.mutate({ id: p.id, visible_to_agency: e.target.checked })}
                    className="rounded accent-violet-600 disabled:opacity-50" />
                  Agentur sichtbar
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline font-medium">Bearbeiten</button>
                  {confirmDel ? (
                    <>
                      <button onClick={() => { deleteMut.mutate(p.id); onClose() }} className="text-xs text-white bg-red-500 px-2.5 py-1 rounded-lg font-bold">Löschen</button>
                      <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-500">Abbrechen</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDel(true)} className="text-xs text-red-400 hover:underline">Löschen</button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Mein Content Tab ─────────────────────────────────────────
function MeinContentTab({ week, year }) {
  const qc = useQueryClient()
  const [subTab, setSubTab]               = useState('woche')  // 'woche' | 'ideen' | 'top'
  const [platform, setPlatform]           = useState('Alle')
  const [partnerFilter, setPartnerFilter] = useState('Alle')
  const [showNew, setShowNew]             = useState(false)
  const [editId, setEditId]               = useState(null)
  const [statusFilter, setStatusFilter]   = useState('Alle')
  const [viewMode, setViewMode]           = useState('list')   // 'list' | 'full'
  const [detailPlan, setDetailPlan]       = useState(null)
  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [showNewAccount, setShowNewAccount]        = useState(false)
  const [newAccountName, setNewAccountName]        = useState('')
  const [accountFilter, setAccountFilter]          = useState(null)  // für Ideen + Top
  const [editAccountMode, setEditAccountMode]      = useState(false)
  const [renamingId, setRenamingId]                = useState(null)
  const [renameValue, setRenameValue]              = useState('')

  // Accounts laden
  const { data: accounts = [] } = useQuery({ queryKey: ['creator-accounts'], queryFn: getCreatorAccounts })

  const addAccountMut = useMutation({
    mutationFn: name => createCreatorAccount({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creator-accounts'] }); setNewAccountName(''); setShowNewAccount(false) },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })
  const renameAccountMut = useMutation({
    mutationFn: ({ id, name }) => updateCreatorAccount(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creator-accounts'] }); setRenamingId(null) },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })
  const delAccountMut = useMutation({
    mutationFn: id => deleteCreatorAccount(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['creator-accounts'] })
      if (selectedAccountId === id) setSelectedAccountId(null)
      if (accountFilter === id) setAccountFilter(null)
    }
  })

  const canCreate = subTab !== 'woche' || selectedAccountId !== null || accounts.length === 0

  const EMPTY_WEEK = { platform: 'IG', title: '', description: '', source_link: '', status: 'planned', visible_to_agency: false, partner_type: 'solo', requisiten: '', kleidung: '' }
  const EMPTY_IDEA = { platform: 'IG', title: '', description: '', source_link: '', status: 'idea',   visible_to_agency: false, partner_type: 'solo', requisiten: '', kleidung: '' }

  // Wochenplan: aktuelle KW, gefiltert nach selectedAccountId
  const { data: weekRaw = [], isLoading: weekLoading, isError: weekError, error: weekErr } = useQuery({
    queryKey: ['plans-creator', week, year, platform, selectedAccountId],
    queryFn: () => getContentPlans({
      week, year,
      ...(platform !== 'Alle' && { platform }),
      ...(selectedAccountId && { account_id: selectedAccountId }),
    })
  })

  // Alle Pläne (Ideen + Top) — cross-account
  const { data: allRaw = [], isLoading: allLoading } = useQuery({
    queryKey: ['plans-creator-all', platform],
    queryFn: () => getContentPlans({ ...(platform !== 'Alle' && { platform }) })
  })

  const applyPartner = list => partnerFilter === 'Alle' ? list : list.filter(p => p.partner_type === partnerFilter.toLowerCase())
  const applyStatus  = list => {
    if (statusFilter === 'geplant')   return list.filter(p => p.status !== 'done' && !p.pushed_to_week)
    if (statusFilter === 'fertig')    return list.filter(p => p.status === 'done')
    if (statusFilter === 'geschoben') return list.filter(p => !!p.pushed_to_week)
    return list
  }
  const applyAccountFilter = list => accountFilter ? list.filter(p => p.account_id === accountFilter) : list

  const weekPlans = applyStatus(applyPartner(weekRaw.filter(p => p.status !== 'idea')))
  const ideaPlans = applyAccountFilter(applyPartner(allRaw.filter(p => p.status === 'idea')))
  const topPlans  = applyAccountFilter(applyPartner(allRaw.filter(p => p.is_top_video)))

  const plans     = subTab === 'woche' ? weekPlans : subTab === 'ideen' ? ideaPlans : topPlans
  const isLoading = subTab === 'woche' ? weekLoading : allLoading

  const invAll = () => {
    qc.invalidateQueries({ queryKey: ['plans-creator'] })
    qc.invalidateQueries({ queryKey: ['plans-creator-all'] })
  }

  const createMut = useMutation({
    mutationFn: data => createContentPlan({
      ...data, week_number: week, year,
      ...(subTab === 'woche' && selectedAccountId && { account_id: selectedAccountId }),
    }),
    onSuccess: () => { invAll(); setShowNew(false) },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateContentPlan(id, data),
    onSuccess: () => { invAll(); setEditId(null) },
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
        ...(p.account_id && { account_id: p.account_id }),
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
  const offen    = weekPlans.filter(p => p.status === 'planned').length
  const erledigt = weekPlans.filter(p => p.status === 'done').length

  const switchTab = val => { setSubTab(val); setShowNew(false); setEditId(null); setStatusFilter('Alle') }

  return (
    <div className="space-y-4">
      {/* Stat-Karten (immer KW-basiert) */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt"   value={gesamt}   color="gray" />
        <StatCard label="Offen"    value={offen}    color="red" />
        <StatCard label="Erledigt" value={erledigt} color="green" />
      </div>

      {/* Account-Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
          <div className="flex items-center gap-2">
            {!editAccountMode && (
              <button onClick={() => setShowNewAccount(v => !v)}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                {showNewAccount ? 'Abbrechen' : '+ Neu'}
              </button>
            )}
            {accounts.length > 0 && (
              <button onClick={() => { setEditAccountMode(v => !v); setRenamingId(null); setShowNewAccount(false) }}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                {editAccountMode ? 'Fertig' : 'Bearbeiten'}
              </button>
            )}
          </div>
        </div>

        {showNewAccount && !editAccountMode && (
          <div className="flex gap-2">
            <input
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newAccountName.trim()) addAccountMut.mutate(newAccountName.trim()) }}
              placeholder="Account-Name…"
              autoFocus
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={() => newAccountName.trim() && addAccountMut.mutate(newAccountName.trim())}
              disabled={addAccountMut.isPending || !newAccountName.trim()}
              className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">
              {addAccountMut.isPending ? '…' : 'Anlegen'}
            </button>
          </div>
        )}

        {editAccountMode ? (
          /* Edit-Modus: umbenennen + löschen */
          <div className="space-y-1.5">
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-2">
                {renamingId === acc.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) renameAccountMut.mutate({ id: acc.id, name: renameValue.trim() }) }}
                      autoFocus
                      className="flex-1 px-2.5 py-1.5 border border-indigo-400 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button onClick={() => renameValue.trim() && renameAccountMut.mutate({ id: acc.id, name: renameValue.trim() })}
                      disabled={renameAccountMut.isPending || !renameValue.trim()}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                      ✓
                    </button>
                    <button onClick={() => setRenamingId(null)}
                      className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs">
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setRenamingId(acc.id); setRenameValue(acc.name) }}
                      className="flex-1 text-left px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                      ✎ {acc.name}
                    </button>
                    <button onClick={() => { if (window.confirm(`"${acc.name}" löschen?`)) delAccountMut.mutate(acc.id) }}
                      className="p-1.5 text-red-300 hover:text-red-500 transition-colors" title="Löschen">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Normal-Modus: Account wählen */
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 w-max">
              <button onClick={() => setSelectedAccountId(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${!selectedAccountId ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Alle
              </button>
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => setSelectedAccountId(acc.id === selectedAccountId ? null : acc.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${selectedAccountId === acc.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hinweis wenn Alle + Accounts vorhanden + Wochenplan */}
        {!selectedAccountId && accounts.length > 0 && subTab === 'woche' && (
          <p className="text-xs text-gray-400 text-center py-1">Account wählen um einen neuen Plan anzulegen</p>
        )}
      </div>

      {/* Unterreiter */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[['woche',`📅 KW${week}`],['ideen','💡 Ideen'],['top','⭐ Top']].map(([val, label]) => (
          <button key={val} onClick={() => switchTab(val)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${subTab === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Account-Filter für Ideen + Top (cross-account filter) */}
      {(subTab === 'ideen' || subTab === 'top') && accounts.length > 0 && (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 w-max">
            <button onClick={() => setAccountFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!accountFilter ? 'bg-gray-700 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Alle Accounts
            </button>
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => setAccountFilter(acc.id === accountFilter ? null : acc.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${accountFilter === acc.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter + View-Toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <PlatformFilter value={platform} onChange={setPlatform} />
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(v => !v)}
              className="hidden sm:flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 transition-colors flex-shrink-0">
              {showNew ? '✕' : '+ Neu'}
            </button>
          )}
          <div className="flex flex-shrink-0 bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setViewMode('list')} title="Listenansicht"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            </button>
            <button onClick={() => setViewMode('full')} title="Vollansicht"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 items-center w-max">
            {[['Alle','Alle'],['solo','👤 Solo'],['partner','👥 Partner']].map(([val, label]) => (
              <button key={val} onClick={() => setPartnerFilter(val)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${partnerFilter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
            {subTab === 'woche' && (
              <>
                <span className="w-px h-3.5 bg-gray-200 flex-shrink-0 mx-0.5" />
                {[['Alle','Alle'],['fertig','✓ Fertig'],['geschoben','→ Geschoben']].map(([val, label]) => (
                  <button key={`s-${val}`} onClick={() => setStatusFilter(val)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${statusFilter === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hinweisbanner */}
      {subTab === 'ideen' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-600">
          💡 Alle Ideen aus allen Accounts und Wochen — zeitunabhängig speichern, später einplanen.
        </div>
      )}
      {subTab === 'top' && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-yellow-700">
          ⭐ Mit dem Stern markierte Videos aus allen Accounts — deine Top-Performance-Inhalte.
        </div>
      )}

      {/* Neuer Eintrag — schwebendes Modal */}
      {showNew && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto"
               style={{ maxHeight: '85dvh' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <p className="text-sm font-semibold text-gray-800">
                {subTab === 'ideen' ? '💡 Neue Idee' : '📅 Neuer Plan'}
              </p>
              <button onClick={() => setShowNew(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-5">
              <PlanForm
                initial={subTab === 'ideen' ? EMPTY_IDEA : EMPTY_WEEK}
                onSave={f => createMut.mutate(f)}
                onCancel={() => setShowNew(false)}
                isPending={createMut.isPending}
                hideStatus={subTab === 'ideen'}
              />
            </div>
          </div>
        </div>,
        document.body
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
          <div className="text-4xl mb-3">{subTab === 'ideen' ? '💡' : subTab === 'top' ? '⭐' : '🎬'}</div>
          <p className="text-gray-400 text-sm">
            {subTab === 'ideen' ? 'Noch keine Ideen gespeichert' : subTab === 'top' ? 'Noch keine Top-Videos markiert' : `Keine Pläne für KW${week}`}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {plans.map(p => (
            <PlanListRow
              key={p.id}
              p={p}
              isIdeaTab={subTab !== 'woche'}
              isTopTab={subTab === 'top'}
              busy={busyId === p.id}
              updateMut={updateMut}
              accounts={accounts}
              onClick={() => setDetailPlan(p)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p, idx) => (
            <PlanCard
              key={p.id}
              p={p} idx={idx}
              week={week} year={year}
              editId={editId} setEditId={setEditId}
              updateMut={updateMut} deleteMut={deleteMut} pushMut={pushMut} undoPushMut={undoPushMut}
              allPlans={allRaw}
              busyId={busyId}
              showWeekBadge={subTab !== 'woche'}
              isIdeaTab={subTab === 'ideen'}
              isTopTab={subTab === 'top'}
              accounts={accounts}
            />
          ))}
        </div>
      )}

      {/* Detail Modal (Listenansicht) */}
      {detailPlan && (
        <PlanDetailModal
          p={detailPlan}
          week={week} year={year}
          onClose={() => setDetailPlan(null)}
          updateMut={updateMut} deleteMut={deleteMut}
          pushMut={pushMut} undoPushMut={undoPushMut}
          allPlans={allRaw}
          busyId={busyId}
          isIdeaTab={subTab !== 'woche'}
        />
      )}

      {/* FAB */}
      {subTab !== 'top' && canCreate && (
        <button onClick={() => setShowNew(v => !v)}
          className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-full shadow-lg shadow-violet-500/40 flex items-center justify-center hover:brightness-110 active:scale-95 transition-all">
          {showNew
            ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            : <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          }
        </button>
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

const FIELD_LABELS = { artist_name: 'Künstlername', photo_url: 'Foto', contact_email: 'E-Mail', phone: 'Telefon', platforms: 'Plattformen' }

const ACTIVATION_STATUS = {
  pending:           { label: 'Konto ausstehend', color: 'bg-gray-100 text-gray-600', icon: '⏳' },
  id_uploaded:       { label: 'Ausweis hochgeladen', color: 'bg-blue-100 text-blue-700', icon: '📄' },
  ai_checked:        { label: 'KI geprüft', color: 'bg-violet-100 text-violet-700', icon: '🤖' },
  agency_confirmed:  { label: 'Wird bestätigt', color: 'bg-amber-100 text-amber-700', icon: '✅' },
  active:            { label: 'Freigeschaltet', color: 'bg-green-100 text-green-700', icon: '✅' },
  rejected:          { label: 'Abgelehnt', color: 'bg-red-100 text-red-700', icon: '❌' },
}

// ── Foto-Upload Helper ───────────────────────────────────────
async function uploadAndRecord(file, creatorId, type, label = null) {
  const { url } = await uploadFile(file, type === 'id_document' ? 'id_document' : 'photo')
  return addCreatorPhoto(creatorId, { url, type, label })
}

// ── Galerie-Abschnitt ────────────────────────────────────────
function PhotoGallery({ creatorId, photos, type, maxCount, label, onUploaded, onDeleted, accept = 'image/*', note }) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const filtered = photos.filter(p => p.type === type)
  const canAdd = filtered.length < maxCount

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !canAdd) return
    e.target.value = ''
    setUploading(true)
    try {
      await uploadAndRecord(file, creatorId, type, null)
      onUploaded()
    } catch(err) {
      alert('Upload fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setUploading(false) }
  }

  async function handleDelete(photoId) {
    setDeletingId(photoId)
    try {
      await deleteCreatorPhoto(creatorId, photoId)
      onDeleted()
    } catch(err) {
      alert('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setDeletingId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label} ({filtered.length}/{maxCount})</p>
      </div>
      {note && <p className="text-xs text-gray-400 mb-2">{note}</p>}
      <div className="flex gap-2 flex-wrap">
        {filtered.map(p => (
          <div key={p.id} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
            <img src={p.url} className="w-full h-full object-cover" alt="" />
            <button
              onClick={() => handleDelete(p.id)}
              disabled={deletingId === p.id}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
              {deletingId === p.id ? '…' : '×'}
            </button>
          </div>
        ))}
        {canAdd && (
          <label className="w-20 h-20 rounded-xl border-2 border-dashed border-violet-300 flex flex-col items-center justify-center cursor-pointer hover:bg-violet-50 transition-colors">
            {uploading
              ? <span className="text-violet-400 text-xs">…</span>
              : <>
                  <svg className="w-6 h-6 text-violet-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  <span className="text-xs text-violet-400">Hinzufügen</span>
                </>
            }
            <input type="file" accept={accept} className="sr-only" onChange={handleUpload} disabled={uploading || !canAdd} capture={type === 'id_document' ? undefined : 'environment'} />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Profil Tab ───────────────────────────────────────────────
function ProfilTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(null)
  const [formErr, setFormErr] = useState('')
  const [profileUploading, setProfileUploading] = useState(false)

  const { data: profile, isLoading } = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile })
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['my-photos', profile?.id],
    queryFn: () => getCreatorPhotos(profile.id),
    enabled: !!profile?.id
  })
  const { data: requests = [] } = useQuery({ queryKey: ['change-requests-creator'], queryFn: getChangeRequests })

  const hasPending = requests.some(r => r.status === 'pending')
  const profilePhoto = photos.find(p => p.type === 'profile')

  const requestMut = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests-creator'] }); setShowForm(false) },
    onError: e => setFormErr(e.response?.data?.error || 'Fehler beim Senden')
  })

  async function handleProfilePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    e.target.value = ''
    setProfileUploading(true)
    try {
      await uploadAndRecord(file, profile.id, 'profile')
      qc.invalidateQueries({ queryKey: ['my-photos', profile.id] })
      qc.invalidateQueries({ queryKey: ['my-profile'] })
    } catch(err) {
      alert('Upload fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setProfileUploading(false) }
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

  const status = ACTIVATION_STATUS[profile.activation_status] || ACTIVATION_STATUS.pending
  const displayPhoto = profilePhoto?.url || profile.photo_url

  return (
    <div className="space-y-4">
      {/* Aktivierungs-Status */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium ${
        profile.activation_status === 'active' ? 'bg-green-50 border-green-200 text-green-700' :
        profile.activation_status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' :
        'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        <span>{status.icon}</span>
        <span>{status.label}</span>
        {profile.activation_status !== 'active' && profile.activation_status !== 'rejected' && (
          <span className="ml-auto text-gray-400">Agentur schaltet dich frei</span>
        )}
      </div>

      {/* Profil-Karte */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {/* Avatar + Upload */}
        <div className="flex items-center gap-4 mb-5">
          <label className="relative cursor-pointer group flex-shrink-0">
            {displayPhoto
              ? <img src={displayPhoto} className="w-20 h-20 rounded-full object-cover" alt="" />
              : <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-2xl">
                  {(profile.artist_name || '?')[0].toUpperCase()}
                </div>
            }
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {profileUploading
                ? <span className="text-white text-xs">…</span>
                : <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              }
            </div>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleProfilePhotoUpload} disabled={profileUploading} />
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

      {/* Rollenfotos / Galerie */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <p className="text-sm font-semibold text-gray-800">Meine Fotos</p>
        <PhotoGallery
          creatorId={profile.id}
          photos={photos}
          type="role"
          maxCount={5}
          label="Rollenfotos / Galerie"
          note="Zeig wie du arbeitest — 5 Fotos, z.B. verschiedene Looks oder Setups."
          onUploaded={() => refetchPhotos()}
          onDeleted={() => refetchPhotos()}
        />
      </div>

      {/* Ausweis-Upload */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Altersnachweis (Ausweis)</p>
          <p className="text-xs text-gray-400 mt-0.5">Wird nur von deiner Agentur gesehen und dient zur Freischaltung deines Kontos.</p>
        </div>
        <PhotoGallery
          creatorId={profile.id}
          photos={photos}
          type="id_document"
          maxCount={2}
          label="Ausweisfoto"
          note="Vorder- und Rückseite deines Personalausweises oder Reisepasses."
          accept="image/*"
          onUploaded={() => { refetchPhotos(); qc.invalidateQueries({ queryKey: ['my-profile'] }) }}
          onDeleted={() => refetchPhotos()}
        />
        {profile.activation_status === 'pending' && photos.filter(p => p.type === 'id_document').length === 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
            📋 Lade deinen Ausweis hoch damit deine Agentur dein Konto freischalten kann.
          </div>
        )}
        {photos.filter(p => p.type === 'id_document').length > 0 && profile.activation_status === 'pending' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
            ✅ Ausweis hochgeladen — deine Agentur wird dein Konto in Kürze freischalten.
          </div>
        )}
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
        <div className="max-w-2xl mx-auto mt-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {['Aufträge','Mein Content','Profil','Statistik'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab===t ? 'bg-white text-violet-700' : 'text-white/80 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {activeTab === 'Aufträge'    && <AuftraegeTab week={week} year={year} />}
        {activeTab === 'Mein Content' && <MeinContentTab week={week} year={year} />}
        {activeTab === 'Profil'      && <ProfilTab />}
        {activeTab === 'Statistik'   && <StatistikTab week={week} year={year} />}
      </div>
    </div>
  )
}
