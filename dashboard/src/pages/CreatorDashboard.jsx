import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getJobStats, getContentPlanStats, getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan } from '../lib/api.js'
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
      <div className="flex items-center gap-3">
        {!hideStatus && (
          <select value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="idea">Idee</option>
            <option value="planned">Geplant</option>
            <option value="done">Fertig</option>
          </select>
        )}
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

// ── Plan-Karte (wiederverwendet in Wochenplan + Ideen) ───────
function PlanCard({ p, idx, week, year, editId, setEditId, updateMut, deleteMut, pushMut, busyId, showWeekBadge, isIdeaTab }) {
  const nxt = nextWeekOf(week, year)
  const [confirmDel, setConfirmDel] = useState(false)
  const busy = busyId === p.id

  function cycleStatus() {
    const next = STATUS_CYCLE_WEEK[(STATUS_CYCLE_WEEK.indexOf(p.status) + 1) % STATUS_CYCLE_WEEK.length]
    updateMut.mutate({ id: p.id, status: next })
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${
      p.status === 'done' ? 'border-green-200 opacity-70' :
      p.carried_over_from ? 'border-amber-300 bg-amber-50/30' :
      'border-gray-200'
    }`}>
      {p.carried_over_from && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-3">
          <span>↩</span><span className="font-medium">Übertrag aus vorheriger Woche</span>
        </div>
      )}

      {editId === p.id ? (
        <PlanForm
          initial={{ platform: p.platform, title: p.title || '', description: p.description || '', status: p.status, visible_to_agency: p.visible_to_agency, partner_type: p.partner_type || 'solo' }}
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
                {showWeekBadge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-400 font-medium">KW{p.week_number}</span>
                )}
                {p.pushed_to_week && (
                  <span className="text-xs text-indigo-400 font-medium">→ KW{p.pushed_to_week}</span>
                )}
              </div>
              {p.title && (
                <p className={`text-sm font-semibold mt-1 ${p.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {p.title}
                </p>
              )}
              {p.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
              )}
            </div>

            {/* Right: status + actions stacked */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {/* Status badge (cycles on tap) */}
              {!isIdeaTab && (
                <button onClick={cycleStatus} disabled={busy}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium hover:opacity-80 disabled:opacity-50 transition-opacity ${PLAN_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                  {updateMut.isPending && updateMut.variables?.id === p.id ? '…' : PLAN_STATUS[p.status] || p.status}
                </button>
              )}

              {/* Action icons row */}
              <div className="flex items-center gap-0.5">
                {/* Edit */}
                <button onClick={() => setEditId(p.id)} disabled={busy}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                  title="Bearbeiten">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Push / Einplanen */}
                {isIdeaTab ? (
                  <button
                    onClick={() => updateMut.mutate({ id: p.id, status: 'planned', week_number: week, year })}
                    disabled={busy}
                    className="text-xs text-violet-600 hover:text-violet-800 font-semibold px-2 py-1 rounded-lg hover:bg-violet-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                    {updateMut.isPending && updateMut.variables?.id === p.id ? '…' : `→ KW${week}`}
                  </button>
                ) : (
                  !p.pushed_to_week && (
                    <button onClick={() => pushMut.mutate(p)} disabled={pushMut.isPending || busy}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                      {pushMut.isPending && pushMut.variables?.id === p.id ? '…' : `→ KW${nxt.week}`}
                    </button>
                  )
                )}

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
          </div>

          {/* ── Footer: agency toggle ──────────────────── */}
          <div className="mt-3 pt-2.5 border-t border-gray-100 pl-11">
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
          </div>
        </>
      )}
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
  const [editId, setEditId]         = useState(null)

  const EMPTY_WEEK = { platform: 'IG', title: '', description: '', status: 'planned', visible_to_agency: false, partner_type: 'solo' }
  const EMPTY_IDEA = { platform: 'IG', title: '', description: '', status: 'idea',   visible_to_agency: false, partner_type: 'solo' }

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

  // Wochenplan: nur geplant + fertig (Ideen gehören in den Ideenspeicher)
  const weekPlans  = applyPartner(weekRaw.filter(p => p.status !== 'idea'))
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
    onSuccess: () => { invAll(); setEditId(null) }
  })

  const deleteMut = useMutation({
    mutationFn: id => deleteContentPlan(id),
    onSuccess: invAll
  })

  const pushMut = useMutation({
    mutationFn: async (p) => {
      const { week: nw, year: ny } = nextWeekOf(week, year)
      await createContentPlan({
        platform: p.platform, title: p.title, description: p.description,
        status: 'idea', visible_to_agency: p.visible_to_agency,
        partner_type: p.partner_type, week_number: nw, year: ny,
        carried_over_from: p.id,
      })
      await updateContentPlan(p.id, { pushed_to_week: nw, pushed_to_year: ny })
    },
    onSuccess: invAll,
    onError: e => alert('Fehler beim Schieben: ' + (e.response?.data?.error || e.message))
  })

  const busyId = (updateMut.isPending && updateMut.variables?.id)
    || (deleteMut.isPending && deleteMut.variables)
    || (pushMut.isPending && pushMut.variables?.id)

  const gesamt   = weekPlans.length
  const offen    = weekPlans.filter(p => p.status === 'planned').length
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
          <button key={val} onClick={() => { setSubTab(val); setShowNew(false); setEditId(null) }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${subTab === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <PlatformFilter value={platform} onChange={setPlatform} />
      <div className="flex gap-2">
        {[['Alle','Alle'],['solo','👤 Solo'],['partner','👥 Partner']].map(([val, label]) => (
          <button key={val} onClick={() => setPartnerFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${partnerFilter === val ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
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
              editId={editId} setEditId={setEditId}
              updateMut={updateMut} deleteMut={deleteMut} pushMut={pushMut}
              busyId={busyId}
              showWeekBadge={subTab === 'ideen'}
              isIdeaTab={subTab === 'ideen'}
            />
          ))}
        </div>
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

  const activeStats = dataType === 'jobs' ? jobStats : planStats

  return (
    <div className="space-y-6">

      {/* ── Wochenübersicht ─────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">KW {week} · {year}</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Gesamt"   value={summary?.total}     color="gray" />
          <StatCard label="Offen"    value={summary?.open}      color="red" />
          <StatCard label="Erledigt" value={summary?.confirmed} color="green" />
        </div>
        {weekJobs.length > 0 ? (
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
        )}
      </div>

      {/* ── Zeitraum-Statistik ───────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Zeitraum</p>

        {/* Datentyp-Toggle */}
        <div className="flex gap-2 mb-4 bg-gray-100 rounded-xl p-1">
          {[['jobs','📋 Aufträge'],['plans','🎬 Eigener Content']].map(([val, label]) => (
            <button key={val} onClick={() => { setDataType(val); setPlatform('Alle') }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${dataType === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

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
