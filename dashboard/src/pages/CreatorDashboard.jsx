import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getJobStats, getContentPlanStats, getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan, getMyProfile, getChangeRequests, createChangeRequest, uploadFile, getCreatorPhotos, addCreatorPhoto, deleteCreatorPhoto, getCreatorAccounts, createCreatorAccount, updateCreatorAccount, deleteCreatorAccount, updateJobStatus, updateJobMeta, getCombinedList } from '../lib/api.js'
import { clearAuth } from '../lib/auth.js'
import StatCard from '../components/StatCard.jsx'
import PlatformFilter from '../components/PlatformFilter.jsx'
import PlatformIcon from '../components/PlatformIcon.jsx'
import WeekNav from '../components/WeekNav.jsx'

// ── SVG-Icon-Helfer (Heroicons-Stil, strokeWidth 1.75) ────────
const IcoCal   = ({s='w-4 h-4'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
const IcoBulb  = ({s='w-4 h-4'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
const IcoStar  = ({s='w-4 h-4',f=false}) => <svg className={s} fill={f?'currentColor':'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
const IcoUser  = ({s='w-3.5 h-3.5'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
const IcoUsers = ({s='w-3.5 h-3.5'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
const IcoPen   = ({s='w-3.5 h-3.5'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
const IcoCopy  = ({s='w-4 h-4'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
const IcoArrow = ({s='w-4 h-4'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
const IcoInbox = ({s='w-12 h-12'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
const IcoFilm  = ({s='w-12 h-12'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>
const IcoChart = ({s='w-12 h-12'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
const IcoList  = ({s='w-4 h-4'}) => <svg className={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>

// ── Desktop breakpoint hook ──────────────────────────────────
function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  useEffect(() => {
    const handler = () => setDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return desktop
}

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
const LOCATION_TAGS   = ['outdoor','indoor','auto','stadt']
const LOCATION_LABELS = { outdoor:'Outdoor', indoor:'Indoor', auto:'Auto', stadt:'Stadt' }

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

// ── Tag-Chip für Jobs (inline in der Liste) ──────────────────
function JobTagRow({ job, onUpdate, busy }) {
  const [open, setOpen] = useState(false)
  const tags = job.location_tags || []
  const hasTag = t => tags.includes(t)
  const toggle = t => onUpdate({ location_tags: hasTag(t) ? tags.filter(x => x !== t) : [...tags, t] })
  const togglePartner = () => onUpdate({ partner_type: job.partner_type === 'partner' ? 'solo' : 'partner' })

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <button onClick={togglePartner} disabled={busy}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border transition-colors disabled:opacity-40 ${job.partner_type === 'partner' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>
        {job.partner_type === 'partner' ? <IcoUsers s="w-3 h-3" /> : <IcoUser s="w-3 h-3" />}
        {job.partner_type === 'partner' ? 'Partner' : 'Solo'}
      </button>
      {LOCATION_TAGS.map(t => (
        <button key={t} onClick={() => toggle(t)} disabled={busy}
          className={`text-xs px-2 py-0.5 rounded-lg border transition-colors disabled:opacity-40 ${hasTag(t) ? 'bg-sky-500 text-white border-sky-500' : 'bg-gray-50 text-gray-300 border-gray-200 hover:border-gray-300 hover:text-gray-500'}`}>
          {LOCATION_LABELS[t]}
        </button>
      ))}
    </div>
  )
}

// ── Aufträge Tab ─────────────────────────────────────────────
function AuftraegeTab({ week, year }) {
  const qc = useQueryClient()
  const isDesktop = useIsDesktop()
  const [subTab, setSubTab]             = useState('jobs')
  const [platform, setPlatform]         = useState('Alle')
  const [partnerFilter, setPartnerFilter] = useState('Alle')
  const [locationFilter, setLocationFilter] = useState([])
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [detailItem, setDetailItem]     = useState(null)

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs-creator', week, year, platform],
    queryFn: () => getJobs({ week, year, ...(platform !== 'Alle' && { platform }) })
  })
  const { data: combined = [], isLoading: combinedLoading } = useQuery({
    queryKey: ['combined-creator', week, year, platform],
    queryFn: () => getCombinedList({ week, year, ...(platform !== 'Alle' && { platform }) }),
    enabled: subTab === 'combined',
  })

  const invJobs = () => {
    qc.invalidateQueries({ queryKey: ['jobs-creator'] })
    qc.invalidateQueries({ queryKey: ['combined-creator'] })
    qc.invalidateQueries({ queryKey: ['summary-creator'] })
  }

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateJobStatus(id, status),
    onSuccess: invJobs,
  })
  const metaMut = useMutation({
    mutationFn: ({ id, ...data }) => updateJobMeta(id, data),
    onSuccess: invJobs,
  })
  const planDoneMut = useMutation({
    mutationFn: id => updateContentPlan(id, { status: 'done' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans-creator'] })
      qc.invalidateQueries({ queryKey: ['combined-creator'] })
    },
  })

  const applyFilters = list => {
    let out = list
    if (partnerFilter !== 'Alle') out = out.filter(i => (i.partner_type || 'solo') === partnerFilter.toLowerCase())
    if (locationFilter.length > 0) out = out.filter(i => locationFilter.every(t => (i.location_tags || []).includes(t)))
    return out
  }

  const activeFilterCount = (partnerFilter !== 'Alle' ? 1 : 0) + (locationFilter.length > 0 ? 1 : 0)

  const isLoading = subTab === 'jobs' ? jobsLoading : combinedLoading
  const rawList   = subTab === 'jobs' ? jobs : combined
  const list      = applyFilters(rawList)

  const gesamt   = rawList.length
  const offen    = rawList.filter(i => i._type === 'plan' ? i.status !== 'done' : !['confirmed','delivered'].includes(i.status)).length
  const erledigt = rawList.filter(i => i._type === 'plan' ? i.status === 'done' : i.status === 'confirmed').length

  // Sync detailItem from fresh data
  const syncedDetail = detailItem ? [...rawList].find(i => i.id === detailItem.id) || detailItem : null

  // Shared filter content for sidebar + bottom sheet
  const filterContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-gray-900 lg:text-sm">Filter</p>
        <button onClick={() => { setPartnerFilter('Alle'); setLocationFilter([]) }}
          className="text-xs text-red-400 hover:text-red-600 font-medium">Zurücksetzen</button>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Art</p>
        <div className="flex gap-2">
          {[['Alle',null,'Alle'],['solo',<IcoUser />,'Solo'],['partner',<IcoUsers />,'Partner']].map(([val,icon,lbl]) => (
            <button key={val} onClick={() => setPartnerFilter(val)}
              className={`flex-1 py-2 lg:py-1.5 rounded-xl text-sm lg:text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${partnerFilter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              {icon}{lbl}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</p>
        <div className="flex flex-wrap gap-2">
          {LOCATION_TAGS.map(tag => {
            const active = locationFilter.includes(tag)
            return (
              <button key={tag}
                onClick={() => setLocationFilter(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                className={`px-3 py-2 lg:px-2.5 lg:py-1.5 rounded-xl text-sm lg:text-xs font-medium border transition-colors ${active ? 'bg-sky-500 text-white border-sky-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                {LOCATION_LABELS[tag]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  // Shared list item renderer
  function ListItem({ item }) {
    const isJob  = item._type !== 'plan'
    const isDone = isJob ? item.status === 'confirmed' : item.status === 'done'
    const busy   = (statusMut.isPending && statusMut.variables?.id === item.id)
                || (metaMut.isPending   && metaMut.variables?.id   === item.id)
                || (planDoneMut.isPending && planDoneMut.variables  === item.id)
    const isSelected = detailItem?.id === item.id
    return (
      <div
        onClick={() => setDetailItem(isSelected ? null : item)}
        className={`bg-white rounded-xl border border-l-4 p-3 transition-all cursor-pointer
          ${isDone ? 'opacity-60' : ''}
          ${isJob ? 'border-l-orange-400' : 'border-l-violet-400'}
          ${isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={e => {
              e.stopPropagation()
              if (isJob) statusMut.mutate({ id: item.id, status: isDone ? 'open' : 'confirmed' })
              else if (!isDone) planDoneMut.mutate(item.id)
            }}
            disabled={busy}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40
              ${isDone ? (isJob ? 'bg-orange-400 border-orange-400' : 'bg-violet-500 border-violet-500') : 'border-gray-300 hover:border-green-400 bg-white'}`}>
            {isDone && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          </button>
          <PlatformIcon platform={item.platform} size="badge" />
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isJob ? 'bg-orange-50 text-orange-600' : 'bg-violet-50 text-violet-600'}`}>
            {isJob ? 'Auftrag' : 'Plan'}
          </span>
          <span className={`flex-1 text-sm truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.title || item.content_type || <span className="text-gray-300 italic text-xs">Kein Titel</span>}
          </span>
          {isJob ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PLAN_COLORS[item.status]}`}>
              {PLAN_STATUS[item.status]}
            </span>
          )}
        </div>
        {/* Tag-Zeile (nur Jobs im Kombiniert-Tab) */}
        {isJob && subTab === 'combined' && (
          <div className="pl-8">
            <JobTagRow job={item} busy={busy} onUpdate={data => metaMut.mutate({ id: item.id, ...data })} />
          </div>
        )}
        {/* Tags anzeigen (Aufträge-Tab oder Plan) */}
        {((item.location_tags || []).length > 0 || item.partner_type === 'partner') && !(isJob && subTab === 'combined') && (
          <div className="pl-8 flex flex-wrap gap-1 mt-1.5">
            {item.partner_type === 'partner' && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 font-medium border border-violet-100 flex items-center gap-1">
                <IcoUsers s="w-3 h-3" />Partner
              </span>
            )}
            {(item.location_tags || []).map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 font-medium border border-sky-100">
                {LOCATION_LABELS[t]}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Detail panel content
  function DetailPanel({ item }) {
    const isJob = item._type !== 'plan'
    const isDone = isJob ? item.status === 'confirmed' : item.status === 'done'
    const busy = (statusMut.isPending && statusMut.variables?.id === item.id)
              || (metaMut.isPending   && metaMut.variables?.id   === item.id)
              || (planDoneMut.isPending && planDoneMut.variables  === item.id)
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={item.platform} size="badge" />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${isJob ? 'bg-orange-50 text-orange-600' : 'bg-violet-50 text-violet-600'}`}>
              {isJob ? 'Auftrag' : 'Plan'}
            </span>
          </div>
          <button onClick={() => setDetailItem(null)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div>
          <p className="text-base font-semibold text-gray-900">
            {item.title || item.content_type || <span className="text-gray-400 italic text-sm">Kein Titel</span>}
          </p>
          {item.description && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{item.description}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {isJob ? (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
          ) : (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[item.status]}`}>
              {PLAN_STATUS[item.status]}
            </span>
          )}
          {item.partner_type && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${item.partner_type === 'partner' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
              {item.partner_type === 'partner' ? <><IcoUsers s="w-3 h-3" /> Partner</> : <><IcoUser s="w-3 h-3" /> Solo</>}
            </span>
          )}
        </div>

        {(item.location_tags || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Location</p>
            <div className="flex flex-wrap gap-1.5">
              {item.location_tags.map(t => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-xl bg-sky-50 text-sky-600 font-medium border border-sky-100">{LOCATION_LABELS[t]}</span>
              ))}
            </div>
          </div>
        )}

        {isJob && subTab === 'combined' && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Taggen</p>
            <JobTagRow job={item} busy={busy} onUpdate={data => metaMut.mutate({ id: item.id, ...data })} />
          </div>
        )}

        {item.source_link && (
          <a href={item.source_link} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Beispiel-Link öffnen
          </a>
        )}

        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => {
              if (isJob) statusMut.mutate({ id: item.id, status: isDone ? 'open' : 'confirmed' })
              else if (!isDone) planDoneMut.mutate(item.id)
            }}
            disabled={busy || (isDone && !isJob)}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40
              ${isDone ? 'bg-gray-100 text-gray-400' : isJob ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>
            {isDone ? 'Erledigt ✓' : isJob ? 'Als bestätigt markieren' : 'Als fertig markieren'}
          </button>
        </div>
      </div>
    )
  }

  // ── Mobile layout ──────────────────────────────────────────
  if (!isDesktop) return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[['jobs','Aufträge'],['combined','Kombiniert']].map(([val, lbl]) => (
          <button key={val} onClick={() => setSubTab(val)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${subTab === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            {lbl}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt"   value={gesamt}   color="gray" />
        <StatCard label="Offen"    value={offen}    color="red" />
        <StatCard label="Erledigt" value={erledigt} color="green" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 w-max">
            <button onClick={() => setPlatform('Alle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${platform === 'Alle' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Alle
            </button>
            {['IG','TK','OF','FL','ML'].map(p => (
              <PlatformIcon key={p} platform={p} size="filter" active={platform === p} onClick={() => setPlatform(p)} />
            ))}
          </div>
        </div>
        <button onClick={() => setShowFilterSheet(true)}
          className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${activeFilterCount > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/></svg>
          Filter
          {activeFilterCount > 0 && (
            <span className="bg-white text-indigo-600 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
      </div>
      {subTab === 'combined' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-600 flex items-center gap-2">
          <IcoList s="w-3.5 h-3.5 flex-shrink-0" /> Agentur-Aufträge <span className="w-2 h-2 rounded-sm bg-orange-400 flex-shrink-0 inline-block" /> und eigene Pläne <span className="w-2 h-2 rounded-sm bg-violet-400 flex-shrink-0 inline-block" /> in einer Liste
        </div>
      )}
      {isLoading ? (
        <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-200 mb-3"><IcoInbox /></div>
          <p className="text-gray-400 text-sm">Keine Einträge für KW{week}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(item => <ListItem key={item.id} item={item} />)}
        </div>
      )}
      {showFilterSheet && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={() => setShowFilterSheet(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg shadow-2xl pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="px-5 pt-2 pb-6">
              {filterContent}
              <button onClick={() => setShowFilterSheet(false)} className="w-full mt-5 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-colors">Anwenden</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  // ── Desktop 3-panel layout ─────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden -mx-4 lg:-mx-6">

      {/* LEFT SIDEBAR */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Sub-tabs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ansicht</p>
            <div className="space-y-1">
              {[['jobs','Aufträge'],['combined','Kombiniert']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setSubTab(val); setDetailItem(null) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${subTab === val ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                  {val === 'jobs' ? <IcoInbox s="w-4 h-4" /> : <IcoList s="w-4 h-4" />}
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {/* Filter */}
          {filterContent}
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 bg-white space-y-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Gesamt"   value={gesamt}   color="gray" />
            <StatCard label="Offen"    value={offen}    color="red" />
            <StatCard label="Erledigt" value={erledigt} color="green" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <button onClick={() => setPlatform('Alle')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${platform === 'Alle' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Alle</button>
              {['IG','TK','OF','FL','ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="filter" active={platform === p} onClick={() => setPlatform(p)} />
              ))}
            </div>
          </div>
          {subTab === 'combined' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs text-indigo-600 flex items-center gap-2">
              <IcoList s="w-3.5 h-3.5 flex-shrink-0" /> Agentur-Aufträge <span className="w-2 h-2 rounded-sm bg-orange-400 flex-shrink-0 inline-block" /> und eigene Pläne <span className="w-2 h-2 rounded-sm bg-violet-400 flex-shrink-0 inline-block" />
            </div>
          )}
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
          ) : list.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-200 mb-3"><IcoInbox /></div>
              <p className="text-gray-400 text-sm">Keine Einträge für KW{week}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(item => <ListItem key={item.id} item={item} />)}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-96 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
        {syncedDetail ? (
          <DetailPanel item={syncedDetail} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <IcoList s="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-sm font-medium text-gray-400">Eintrag auswählen</p>
            <p className="text-xs text-gray-300 mt-1">Klicke auf einen Eintrag in der Liste</p>
          </div>
        )}
      </div>

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
        {[['solo', <IcoUser />, 'Solo'], ['partner', <IcoUsers />, 'Partner']].map(([val, icon, lbl]) => (
          <button key={val} type="button" onClick={() => setF(x => ({ ...x, partner_type: val }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${f.partner_type === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            {icon} {lbl}
          </button>
        ))}
      </div>
      {/* Location Tags */}
      <div className="flex flex-wrap gap-1.5">
        {LOCATION_TAGS.map(tag => {
          const active = (f.location_tags || []).includes(tag)
          return (
            <button key={tag} type="button"
              onClick={() => setF(x => ({ ...x, location_tags: active ? (x.location_tags||[]).filter(t=>t!==tag) : [...(x.location_tags||[]), tag] }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
              {LOCATION_LABELS[tag]}
            </button>
          )
        })}
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
function PlanCard({ p, idx, week, year, editId, setEditId, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, showWeekBadge, isIdeaTab, isTopTab, accounts, onPushRequest }) {
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
          initial={{ platform: p.platform, title: p.title || '', description: p.description || '', source_link: p.source_link || '', status: p.status, visible_to_agency: p.visible_to_agency, partner_type: p.partner_type || 'solo', requisiten: p.requisiten || '', kleidung: p.kleidung || '', location_tags: p.location_tags || [] }}
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
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${p.partner_type === 'partner' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.partner_type === 'partner' ? <><IcoUsers /> Partner</> : <><IcoUser /> Solo</>}
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
              {(p.location_tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.location_tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 font-medium border border-sky-100">
                      {LOCATION_LABELS[tag]}
                    </span>
                  ))}
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
              {isIdeaTab || isTopTab ? (
                <button
                  onClick={() => onPushRequest && onPushRequest(p)}
                  disabled={busy}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border border-violet-400 text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {`→ KW${week}`}
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
                  <button onClick={() => { deleteMut.mutate({ id: p.id, is_top_video: p.is_top_video, fromWoche: !isIdeaTab && !isTopTab }); setConfirmDel(false) }}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 font-bold px-2 py-1 rounded-lg transition-colors">
                    {!isIdeaTab && !isTopTab && p.is_top_video ? 'Aus Woche' : 'Ja'}
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
      <span className="text-gray-400 flex-shrink-0">{p.partner_type === 'partner' ? <IcoUsers /> : <IcoUser />}</span>
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
      {p.is_top_video && <span className="text-yellow-400 flex-shrink-0"><IcoStar s="w-3.5 h-3.5" f={true} /></span>}
      {(p.location_tags || []).length > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-500 font-medium flex-shrink-0 border border-sky-100">
          {p.location_tags.map(t => LOCATION_LABELS[t]).join(' · ')}
        </span>
      )}
      {/* Chevron */}
      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  )
}

// ── Plan Detail Content (shared between modal and desktop panel) ─
function PlanDetailContent({ p, week, year, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, isIdeaTab, isTopTab, onPushRequest, onClose }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const nxt = nextWeekOf(week, year)
  const busy = busyId === p.id

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformIcon platform={p.platform} size="badge" />
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1">{p.partner_type === 'partner' ? <><IcoUsers /> Partner</> : <><IcoUser /> Solo</>}</span>
          {p.carried_over_from && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">↩ Übertrag</span>}
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">
        {editing ? (
          <PlanForm
            initial={{ platform: p.platform, title: p.title || '', description: p.description || '', source_link: p.source_link || '', status: p.status, visible_to_agency: p.visible_to_agency, partner_type: p.partner_type || 'solo', requisiten: p.requisiten || '', kleidung: p.kleidung || '', location_tags: p.location_tags || [] }}
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
            {(p.location_tags || []).length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Location</span>
                <div className="flex flex-wrap gap-1.5">
                  {p.location_tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 font-medium border border-sky-100">
                      {LOCATION_LABELS[tag]}
                    </span>
                  ))}
                </div>
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
              {!isIdeaTab && !isTopTab && (
                <button onClick={() => updateMut.mutate({ id: p.id, status: p.status === 'done' ? 'planned' : 'done' })} disabled={busy}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${p.status === 'done' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                  {p.status === 'done' ? '↩ Als offen markieren' : '✓ Als fertig markieren'}
                </button>
              )}
              {isIdeaTab || isTopTab ? (
                <button onClick={() => { onClose(); onPushRequest && onPushRequest(p) }} disabled={busy}
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
                    <button onClick={() => { deleteMut.mutate({ id: p.id, is_top_video: p.is_top_video, fromWoche: !isIdeaTab && !isTopTab }); onClose() }} className="text-xs text-white bg-red-500 px-2.5 py-1 rounded-lg font-bold">
                      {!isIdeaTab && !isTopTab && p.is_top_video ? 'Aus Woche entfernen' : 'Löschen'}
                    </button>
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
  )
}

// ── Plan Detail Modal ────────────────────────────────────────
function PlanDetailModal({ p, week, year, onClose, updateMut, deleteMut, pushMut, undoPushMut, allPlans, busyId, isIdeaTab, isTopTab, onPushRequest }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto"
           style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
        <PlanDetailContent
          p={p} week={week} year={year}
          updateMut={updateMut} deleteMut={deleteMut}
          pushMut={pushMut} undoPushMut={undoPushMut}
          allPlans={allPlans}
          busyId={busyId}
          isIdeaTab={isIdeaTab}
          isTopTab={isTopTab}
          onPushRequest={onPushRequest}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  )
}

// ── Push-Dialog (Ideen / Top → aktuelle Woche) ───────────────
function PushDialog({ plan, week, accounts, onConfirm, onClose, isPending }) {
  const [pushAccountId, setPushAccountId] = useState(
    plan.account_id && accounts.find(a => a.id === plan.account_id) ? plan.account_id :
    accounts.length === 1 ? accounts[0].id : null
  )
  const [mode, setMode] = useState('kopieren')
  const canConfirm = !isPending && (accounts.length === 0 || pushAccountId !== null)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl w-full max-w-lg shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pt-2 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <PlatformIcon platform={plan.platform} size="sm" />
            <div>
              <p className="text-base font-bold text-gray-900">In KW{week} einplanen</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{plan.title || 'Kein Titel'}</p>
            </div>
          </div>

          {/* Account — Pflicht wenn Accounts vorhanden */}
          {accounts.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
                <span className="text-red-400 text-[10px] font-bold">Pflicht</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {accounts.map(acc => (
                  <button key={acc.id} onClick={() => setPushAccountId(acc.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${pushAccountId === acc.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {acc.name}
                  </button>
                ))}
              </div>
              {!pushAccountId && (
                <p className="text-xs text-red-400 mt-1.5">Bitte einen Account auswählen</p>
              )}
            </div>
          )}

          {/* Modus: Kopieren / Verschieben */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Wie einplanen?</p>
            <div className="flex gap-2">
              <button onClick={() => setMode('kopieren')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${mode === 'kopieren' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                <IcoCopy /> Kopieren
              </button>
              <button onClick={() => setMode('verschieben')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${mode === 'verschieben' ? 'bg-violet-600 text-white border-violet-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                <IcoArrow /> Verschieben
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {mode === 'kopieren' ? 'Original bleibt in Ideen / Top erhalten.' : 'Original wird aus Ideen / Top entfernt.'}
            </p>
          </div>

          <button
            onClick={() => canConfirm && onConfirm({ accountId: pushAccountId, mode })}
            disabled={!canConfirm}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            {isPending ? '…' : `→ KW${week} einplanen`}
          </button>
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
  const [showFilterSheet, setShowFilterSheet]      = useState(false)
  const [pushDialog, setPushDialog]                = useState(null)  // { plan } | null
  const [locationFilter, setLocationFilter]        = useState([])    // multi-select: []|['outdoor',...]

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

  const EMPTY_WEEK = { platform: 'IG', title: '', description: '', source_link: '', status: 'planned', visible_to_agency: false, partner_type: 'solo', requisiten: '', kleidung: '', location_tags: [] }
  const EMPTY_IDEA = { platform: 'IG', title: '', description: '', source_link: '', status: 'idea',   visible_to_agency: false, partner_type: 'solo', requisiten: '', kleidung: '', location_tags: [] }

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

  const applyPartner   = list => partnerFilter === 'Alle' ? list : list.filter(p => p.partner_type === partnerFilter.toLowerCase())
  const applyStatus    = list => {
    if (statusFilter === 'geplant')   return list.filter(p => p.status !== 'done' && !p.pushed_to_week)
    if (statusFilter === 'fertig')    return list.filter(p => p.status === 'done')
    if (statusFilter === 'geschoben') return list.filter(p => !!p.pushed_to_week)
    return list
  }
  const applyAccountFilter  = list => accountFilter ? list.filter(p => p.account_id === accountFilter) : list
  const applyLocationFilter = list => locationFilter.length === 0 ? list : list.filter(p => locationFilter.every(t => (p.location_tags || []).includes(t)))

  const weekPlans = applyLocationFilter(applyStatus(applyPartner(weekRaw.filter(p => p.status !== 'idea'))))
  const ideaPlans = applyLocationFilter(applyAccountFilter(applyPartner(allRaw.filter(p => p.status === 'idea'))))
  const topPlans  = applyLocationFilter(applyAccountFilter(applyPartner(allRaw.filter(p => p.is_top_video))))

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
    mutationFn: ({ id, is_top_video, fromWoche }) => {
      if (fromWoche && is_top_video) {
        return updateContentPlan(id, { week_number: null, year: null })
      }
      return deleteContentPlan(id)
    },
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

  const pushFromIdOrTopMut = useMutation({
    mutationFn: async ({ plan, accountId, mode }) => {
      await createContentPlan({
        platform: plan.platform,
        title: plan.title,
        description: plan.description,
        source_link: plan.source_link || null,
        status: 'planned',
        visible_to_agency: plan.visible_to_agency,
        partner_type: plan.partner_type || 'solo',
        week_number: week,
        year,
        carried_over_from: plan.id,
        requisiten: plan.requisiten || null,
        kleidung: plan.kleidung || null,
        ...(accountId && { account_id: accountId }),
      })
      if (mode === 'verschieben') {
        await deleteContentPlan(plan.id)
      }
    },
    onSuccess: () => { invAll(); setPushDialog(null) },
    onError: e => alert('Fehler beim Einplanen: ' + (e.response?.data?.error || e.message))
  })

  const busyId = (updateMut.isPending && updateMut.variables?.id)
    || (deleteMut.isPending && deleteMut.variables?.id)
    || (pushMut.isPending && pushMut.variables?.id)
    || (undoPushMut.isPending && undoPushMut.variables?.id)
    || (pushFromIdOrTopMut.isPending && pushFromIdOrTopMut.variables?.plan?.id)

  const handlePushRequest = (p) => setPushDialog({ plan: p })

  const gesamt   = weekPlans.length
  const offen    = weekPlans.filter(p => p.status === 'planned').length
  const erledigt = weekPlans.filter(p => p.status === 'done').length

  const switchTab = val => { setSubTab(val); setShowNew(false); setEditId(null); setStatusFilter('Alle') }

  const isDesktop = useIsDesktop()

  // Helper: compute active filter count for the filter button badge
  const activeFilterCount = (partnerFilter !== 'Alle' ? 1 : 0)
    + (subTab === 'woche' && statusFilter !== 'Alle' ? 1 : 0)
    + ((subTab === 'ideen' || subTab === 'top') && accountFilter ? 1 : 0)
    + (locationFilter.length > 0 ? 1 : 0)

  // The plan list (shared between mobile and desktop center panel)
  const planListContent = (
    <>
      {weekError && subTab === 'woche' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Fehler: {weekErr?.response?.data?.detail || weekErr?.response?.data?.error || weekErr?.message}
        </div>
      ) : isLoading ? (
        <p className="text-center text-gray-400 text-sm py-8">Lädt…</p>
      ) : plans.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-gray-200 mb-3">{subTab === 'ideen' ? <IcoBulb s="w-12 h-12" /> : subTab === 'top' ? <IcoStar s="w-12 h-12" /> : <IcoFilm />}</div>
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
              onClick={() => { setDetailPlan(p); setShowNew(false) }}
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
              onPushRequest={handlePushRequest}
            />
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-4 lg:space-y-0 lg:flex lg:h-full lg:overflow-hidden">

      {/* ─── LEFT SIDEBAR (desktop only) ─── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 lg:bg-white lg:border-r lg:border-gray-200 lg:overflow-y-auto">
        <div className="p-5 space-y-6 flex-1">

          {/* Sub-tabs as nav buttons */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ansicht</p>
            <div className="space-y-0.5">
              {([
                ['woche', <IcoCal />, `KW${week}`],
                ['ideen', <IcoBulb />, 'Ideen'],
                ['top', <IcoStar f={subTab==='top'} />, 'Top-Videos'],
              ]).map(([val, icon, lbl]) => (
                <button key={val} onClick={() => switchTab(val)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${subTab === val ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                  {icon}<span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Account selector — desktop vertical style */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
              <div className="flex items-center gap-2">
                {!editAccountMode && (
                  <button onClick={() => setShowNewAccount(v => !v)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                    {showNewAccount ? 'Abbrechen' : '+ Neu'}
                  </button>
                )}
                {accounts.length > 0 && (
                  <button onClick={() => { setEditAccountMode(v => !v); setRenamingId(null); setShowNewAccount(false) }} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                    {editAccountMode ? 'Fertig' : 'Bearbeiten'}
                  </button>
                )}
              </div>
            </div>
            {showNewAccount && !editAccountMode && (
              <div className="flex gap-2 mb-2">
                <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newAccountName.trim()) addAccountMut.mutate(newAccountName.trim()) }}
                  placeholder="Account-Name…" autoFocus
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <button onClick={() => newAccountName.trim() && addAccountMut.mutate(newAccountName.trim())}
                  disabled={addAccountMut.isPending || !newAccountName.trim()}
                  className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  {addAccountMut.isPending ? '…' : 'Anlegen'}
                </button>
              </div>
            )}
            {editAccountMode ? (
              <div className="space-y-1">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2">
                    {renamingId === acc.id ? (
                      <>
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) renameAccountMut.mutate({ id: acc.id, name: renameValue.trim() }) }}
                          autoFocus className="flex-1 px-2.5 py-1.5 border border-indigo-400 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <button onClick={() => renameValue.trim() && renameAccountMut.mutate({ id: acc.id, name: renameValue.trim() })} disabled={renameAccountMut.isPending || !renameValue.trim()} className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">✓</button>
                        <button onClick={() => setRenamingId(null)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setRenamingId(acc.id); setRenameValue(acc.name) }}
                          className="flex-1 text-left px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center gap-2">
                          <IcoPen s="w-3 h-3" />{acc.name}
                        </button>
                        <button onClick={() => { if (window.confirm(`"${acc.name}" löschen?`)) delAccountMut.mutate(acc.id) }} className="p-1.5 text-red-300 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                <button onClick={() => setSelectedAccountId(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${!selectedAccountId ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Alle Accounts
                </button>
                {accounts.map(acc => (
                  <button key={acc.id} onClick={() => setSelectedAccountId(acc.id === selectedAccountId ? null : acc.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedAccountId === acc.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {acc.name}
                  </button>
                ))}
                {!selectedAccountId && accounts.length > 0 && subTab === 'woche' && (
                  <p className="text-xs text-gray-400 px-3 pt-1">Account wählen um einen neuen Plan anzulegen</p>
                )}
              </div>
            )}
          </div>

          {/* Neuer Plan / Neue Idee — Sidebar-Button (desktop) */}
          {subTab !== 'top' && (
            <button
              onClick={() => { setShowNew(true); setDetailPlan(null) }}
              disabled={subTab === 'woche' && !selectedAccountId && accounts.length > 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              {subTab === 'ideen' ? 'Neue Idee' : 'Neuer Plan'}
            </button>
          )}

          {/* Partner filter (vertical list) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Art</p>
            <div className="space-y-0.5">
              {[['Alle',null,'Alle'],['solo',<IcoUser />,'Solo'],['partner',<IcoUsers />,'Partner']].map(([val,icon,lbl]) => (
                <button key={val} onClick={() => setPartnerFilter(val)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${partnerFilter === val ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {icon}<span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status filter (Woche only) */}
          {subTab === 'woche' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</p>
              <div className="space-y-0.5">
                {[['Alle','Alle'],['geplant','Geplant'],['fertig','✓ Fertig'],['geschoben','→ Geschoben']].map(([val,lbl]) => (
                  <button key={val} onClick={() => setStatusFilter(val)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${statusFilter === val ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location filter (multi-select chips) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</p>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_TAGS.map(tag => {
                const active = locationFilter.includes(tag)
                return (
                  <button key={tag}
                    onClick={() => setLocationFilter(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-sky-500 text-white border-sky-500' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {LOCATION_LABELS[tag]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Account filter for Ideen/Top */}
          {(subTab === 'ideen' || subTab === 'top') && accounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Account-Filter</p>
              <div className="space-y-0.5">
                <button onClick={() => setAccountFilter(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${!accountFilter ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Alle
                </button>
                {accounts.map(acc => (
                  <button key={acc.id} onClick={() => setAccountFilter(acc.id === accountFilter ? null : acc.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${accountFilter === acc.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Reset button — only when filters active */}
        {(partnerFilter !== 'Alle' || statusFilter !== 'Alle' || accountFilter || locationFilter.length > 0) && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <button onClick={() => { setPartnerFilter('Alle'); setStatusFilter('Alle'); setAccountFilter(null); setLocationFilter([]) }}
              className="w-full py-2 text-sm text-red-400 hover:text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors">
              Filter zurücksetzen
            </button>
          </div>
        )}
      </aside>

      {/* ─── CENTER CONTENT ─── */}
      <div className="lg:flex-1 lg:min-w-0 lg:overflow-y-auto">
        <div className="space-y-4 lg:p-6">

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Gesamt"   value={gesamt}   color="gray" />
            <StatCard label="Offen"    value={offen}    color="red" />
            <StatCard label="Erledigt" value={erledigt} color="green" />
          </div>

          {/* MOBILE ONLY: account selector + sub-tabs + filter row */}
          <div className="lg:hidden space-y-4">
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
                            className="flex-1 text-left px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center gap-2">
                            <IcoPen s="w-3 h-3" />{acc.name}
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

              {!selectedAccountId && accounts.length > 0 && subTab === 'woche' && (
                <p className="text-xs text-gray-400 text-center py-1">Account wählen um einen neuen Plan anzulegen</p>
              )}
            </div>

            {/* Unterreiter */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                ['woche', <IcoCal />,              `KW${week}`],
                ['ideen', <IcoBulb />,             'Ideen'],
                ['top',   <IcoStar f={subTab==='top'} />, 'Top'],
              ]).map(([val, icon, lbl]) => (
                <button key={val} onClick={() => switchTab(val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${subTab === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {icon}{lbl}
                </button>
              ))}
            </div>

            {/* Filter-Zeile: Platform scrollbar + Filter-Button + View-Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1.5 w-max">
                  <button onClick={() => setPlatform('Alle')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${platform === 'Alle' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    Alle
                  </button>
                  {['IG','TK','OF','FL','ML'].map(p => (
                    <PlatformIcon key={p} platform={p} size="filter" active={platform === p} onClick={() => setPlatform(p)} />
                  ))}
                </div>
              </div>
              <button onClick={() => setShowFilterSheet(true)}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${activeFilterCount > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/>
                </svg>
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-white text-indigo-600 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="flex flex-shrink-0 bg-gray-100 rounded-lg p-0.5 gap-0.5">
                <button onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                </button>
                <button onClick={() => setViewMode('full')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
                </button>
              </div>
            </div>
          </div>
          {/* END MOBILE ONLY */}

          {/* DESKTOP ONLY: platform filter row + view toggle */}
          <div className="hidden lg:flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <button onClick={() => setPlatform('Alle')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${platform === 'Alle' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Alle</button>
              {['IG','TK','OF','FL','ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="filter" active={platform === p} onClick={() => setPlatform(p)} />
              ))}
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              </button>
              <button onClick={() => setViewMode('full')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
              </button>
            </div>
          </div>

          {/* Hint banners */}
          {subTab === 'ideen' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-600 flex items-center gap-2">
              <IcoBulb s="w-3.5 h-3.5 flex-shrink-0" /> Alle Ideen aus allen Accounts und Wochen — zeitunabhängig speichern, später einplanen.
            </div>
          )}
          {subTab === 'top' && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-yellow-700 flex items-center gap-2">
              <IcoStar s="w-3.5 h-3.5 flex-shrink-0" f={true} /> Mit dem Stern markierte Videos aus allen Accounts — deine Top-Performance-Inhalte.
            </div>
          )}

          {/* Plan list */}
          {planListContent}

          {/* "New plan" dashed button (MOBILE ONLY, below list) */}
          <div className="lg:hidden">
            {subTab !== 'top' && canCreate && (
              <button onClick={() => setShowNew(v => !v)} className="w-full py-4 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-400 text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                + {subTab === 'ideen' ? 'Neue Idee anlegen' : 'Neuer Content-Plan'}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ─── RIGHT PANEL (desktop only) ─── */}
      <div className="hidden lg:flex lg:flex-col lg:w-96 lg:flex-shrink-0 lg:border-l lg:border-gray-200 lg:bg-white lg:overflow-y-auto">
        {showNew ? (
          <div className="p-5 flex-1">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                {subTab === 'ideen' ? <><IcoBulb s="w-4 h-4" /> Neue Idee</> : <><IcoCal s="w-4 h-4" /> Neuer Plan KW{week}</>}
              </h3>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            {subTab === 'woche' && !selectedAccountId && accounts.length > 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3 mx-auto">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Account auswählen</p>
                <p className="text-xs text-gray-400 mt-1">Wähle links einen Account aus, um einen Plan anzulegen.</p>
              </div>
            ) : (
              <PlanForm
                initial={subTab === 'ideen' ? EMPTY_IDEA : EMPTY_WEEK}
                onSave={f => createMut.mutate(f)}
                onCancel={() => setShowNew(false)}
                isPending={createMut.isPending}
                hideStatus={subTab === 'ideen'}
              />
            )}
          </div>
        ) : detailPlan ? (
          <PlanDetailContent
            p={detailPlan}
            week={week} year={year}
            updateMut={updateMut} deleteMut={deleteMut}
            pushMut={pushMut} undoPushMut={undoPushMut}
            allPlans={allRaw}
            busyId={busyId}
            isIdeaTab={subTab !== 'woche'}
            isTopTab={subTab === 'top'}
            onPushRequest={handlePushRequest}
            onClose={() => setDetailPlan(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <IcoList s="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-sm font-medium text-gray-400">Plan auswählen</p>
            <p className="text-xs text-gray-300 mt-1">Klicke auf einen Plan in der Liste</p>
          </div>
        )}
      </div>

      {/* ─── Mobile-only portals ─── */}
      {/* Filter Bottom-Sheet */}
      {showFilterSheet && !isDesktop && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={() => setShowFilterSheet(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg shadow-2xl pb-safe"
               onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-5 pt-2 pb-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-900">Filter</p>
                <button
                  onClick={() => { setPartnerFilter('Alle'); setStatusFilter('Alle'); setAccountFilter(null); setLocationFilter([]) }}
                  className="text-xs text-red-400 hover:text-red-600 font-medium">
                  Zurücksetzen
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Art</p>
                <div className="flex gap-2">
                  {([
                    ['Alle',    null,        'Alle'],
                    ['solo',    <IcoUser />, 'Solo'],
                    ['partner', <IcoUsers />,'Partner'],
                  ]).map(([val, icon, lbl]) => (
                    <button key={val} onClick={() => setPartnerFilter(val)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${partnerFilter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {icon}{lbl}
                    </button>
                  ))}
                </div>
              </div>
              {subTab === 'woche' && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</p>
                  <div className="flex gap-2">
                    {[['Alle','Alle'],['fertig','✓ Fertig'],['geschoben','→ Geschoben']].map(([val, lbl]) => (
                      <button key={val} onClick={() => setStatusFilter(val)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${statusFilter === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(subTab === 'ideen' || subTab === 'top') && accounts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Account</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setAccountFilter(null)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${!accountFilter ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      Alle
                    </button>
                    {accounts.map(acc => (
                      <button key={acc.id} onClick={() => setAccountFilter(acc.id === accountFilter ? null : acc.id)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${accountFilter === acc.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</p>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_TAGS.map(tag => {
                    const active = locationFilter.includes(tag)
                    return (
                      <button key={tag}
                        onClick={() => setLocationFilter(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${active ? 'bg-sky-500 text-white border-sky-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {LOCATION_LABELS[tag]}
                      </button>
                    )
                  })}
                </div>
                {locationFilter.length > 1 && (
                  <p className="text-xs text-gray-400 mt-1.5">Mehrfachauswahl: zeigt Videos mit allen gewählten Tags</p>
                )}
              </div>
              <button onClick={() => setShowFilterSheet(false)}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-colors">
                Anwenden
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New plan modal (mobile only) */}
      {showNew && !isDesktop && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto"
               style={{ maxHeight: '85dvh' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <p className="text-sm font-semibold text-gray-800">
                <span className="flex items-center gap-1.5">{subTab === 'ideen' ? <><IcoBulb s="w-3.5 h-3.5" /> Neue Idee</> : <><IcoCal s="w-3.5 h-3.5" /> Neuer Plan</>}</span>
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

      {/* Detail Modal (mobile only) */}
      {detailPlan && !isDesktop && (
        <PlanDetailModal
          p={detailPlan}
          week={week} year={year}
          onClose={() => setDetailPlan(null)}
          updateMut={updateMut} deleteMut={deleteMut}
          pushMut={pushMut} undoPushMut={undoPushMut}
          allPlans={allRaw}
          busyId={busyId}
          isIdeaTab={subTab !== 'woche'}
          isTopTab={subTab === 'top'}
          onPushRequest={handlePushRequest}
        />
      )}

      {/* Push-Dialog — on both mobile and desktop */}
      {pushDialog && (
        <PushDialog
          plan={pushDialog.plan}
          week={week}
          accounts={accounts}
          onConfirm={({ accountId, mode }) =>
            pushFromIdOrTopMut.mutate({ plan: pushDialog.plan, accountId, mode })
          }
          onClose={() => !pushFromIdOrTopMut.isPending && setPushDialog(null)}
          isPending={pushFromIdOrTopMut.isPending}
        />
      )}

      {/* FAB (hidden on desktop) */}
      {subTab !== 'top' && canCreate && (
        <button onClick={() => setShowNew(v => !v)}
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-full shadow-lg shadow-violet-500/40 flex items-center justify-center hover:brightness-110 active:scale-95 transition-all">
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
          <div className="text-gray-200 mb-2"><IcoChart /></div>
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
        {([
          ['jobs',  <IcoList />,  'Aufträge'],
          ['plans', <IcoFilm s="w-4 h-4" />, 'Eigener Content'],
        ]).map(([val, icon, lbl]) => (
          <button key={val} onClick={() => { setDataType(val); setPlatform('Alle') }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${dataType === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            {icon}{lbl}
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
    <div className="min-h-screen lg:h-screen lg:flex lg:flex-col bg-gray-50">
      {/* Header — gradient, sticky, full width */}
      <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white px-6 pb-4 lg:flex-shrink-0 sticky top-0 z-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        <div className="flex items-center justify-between lg:max-w-none lg:px-2">
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
        {/* Pill-Tabs — left-aligned on desktop */}
        <div className="mt-4 flex gap-1 pb-1 lg:justify-start justify-center">
          {['Aufträge','Mein Content','Profil','Statistik'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${activeTab===t ? 'bg-white text-violet-700' : 'text-white/80 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="lg:flex-1 lg:overflow-hidden">
        {activeTab === 'Mein Content'
          ? <MeinContentTab week={week} year={year} />
          : (
            <div className="max-w-3xl mx-auto px-6 py-6">
              {activeTab === 'Aufträge'   && <AuftraegeTab week={week} year={year} />}
              {activeTab === 'Profil'     && <ProfilTab />}
              {activeTab === 'Statistik'  && <StatistikTab week={week} year={year} />}
            </div>
          )
        }
      </div>
    </div>
  )
}
