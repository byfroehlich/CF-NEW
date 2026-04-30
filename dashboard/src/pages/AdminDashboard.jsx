import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getCreators, getAgencies, createCreator, createAgency, getLogs, getLogSummary } from '../lib/api.js'
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

const TABS = ['Aufträge', 'Creator', 'Agentur', 'Statistik', 'Nutzer', 'System']

// ── Logo Header ──────────────────────────────────────────────
function AdminHeader({ tab, week, year, onWeekChange, onLogout }) {
  return (
    <div className="bg-gray-900 text-white px-6 pb-4 sticky top-0 z-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">CF</span>
          </div>
          <div>
            <div className="font-bold text-base leading-none">CreatorFlow</div>
            <div className="text-xs text-gray-400 mt-0.5">ADMIN · Agentur-Übersicht</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {['Aufträge','Statistik'].includes(tab) && (
            <div className="text-white">
              <WeekNav week={week} year={year} onChange={onWeekChange} />
            </div>
          )}
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-white uppercase tracking-wide">Abmelden</button>
        </div>
      </div>
    </div>
  )
}

// ── Aufträge Tab ─────────────────────────────────────────────
function AuftraegeTab({ week, year }) {
  const [platform, setPlatform] = useState('Alle')
  const { data: summary } = useQuery({ queryKey: ['summary-admin', week, year], queryFn: () => getJobSummary({ week, year }) })
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs-admin', week, year, platform], queryFn: () => getJobs({ week, year, ...(platform !== 'Alle' && { platform }) }) })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Gesamt"    value={summary?.total}       color="gray"   topBar />
        <StatCard label="Offen"     value={summary?.open}        color="red"    topBar />
        <StatCard label="In Arbeit" value={summary?.in_progress} color="orange" topBar />
        <StatCard label="Geliefert" value={summary?.delivered}   color="green"  topBar />
        <StatCard label="Überträge" value={summary?.carried}     color="yellow" topBar />
      </div>
      <PlatformFilter value={platform} onChange={setPlatform} dark />
      {isLoading ? (
        <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
      ) : jobs.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Keine Jobs für diese Auswahl.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {jobs.map(j => (
            <div key={j.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-900">{j.artist_name || j.real_name}</span>
                <PlatformIcon platform={j.platform} size="badge" className="ml-2" />
                {j.agency_name && <span className="text-gray-400 ml-2 text-xs">· {j.agency_name}</span>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                { open:'bg-red-100 text-red-700', in_progress:'bg-orange-100 text-orange-700', delivered:'bg-green-100 text-green-700', confirmed:'bg-blue-100 text-blue-700', carried:'bg-yellow-100 text-yellow-700' }[j.status]
              }`}>{{ open:'Offen', in_progress:'In Arbeit', delivered:'Geliefert', confirmed:'Bestätigt', carried:'Übertrag' }[j.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Creator Tab ──────────────────────────────────────────────
function PLATFORMS_MULTI() {
  return ['IG','TK','OF','FL','ML']
}

function CreatorTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ real_name:'', artist_name:'', contact_email:'', phone:'', birthday:'', platforms:[], notes:'', agency_id:'', login_email:'', login_password:'' })
  const [err, setErr] = useState('')

  const { data: creators = [] } = useQuery({ queryKey: ['creators-admin'], queryFn: getCreators })
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies-admin'], queryFn: getAgencies })

  const mutation = useMutation({
    mutationFn: createCreator,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creators-admin'] }); setShowForm(false); setForm({ real_name:'',artist_name:'',contact_email:'',phone:'',birthday:'',platforms:[],notes:'',agency_id:'',login_email:'',login_password:'' }) },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })

  function togglePlatform(p) {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms, p] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Creator-Kartei <span className="text-gray-400 font-normal text-sm">{creators.length} Creator</span></h2>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Creator onboarden</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">+ Neuer Creator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bürgerlicher Name *" value={form.real_name} onChange={v => setForm(f=>({...f,real_name:v}))} placeholder="z.B. Maja Schmidt" />
            <Field label="Künstlername" value={form.artist_name} onChange={v => setForm(f=>({...f,artist_name:v}))} placeholder="z.B. MajaCurvyOfficial" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-Mail" value={form.contact_email} onChange={v => setForm(f=>({...f,contact_email:v}))} placeholder="maja@example.com" type="email" />
            <Field label="Telefon" value={form.phone} onChange={v => setForm(f=>({...f,phone:v}))} placeholder="+49 …" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Geburtstag" value={form.birthday} onChange={v => setForm(f=>({...f,birthday:v}))} type="date" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agentur *</label>
              <select value={form.agency_id} onChange={e => setForm(f=>({...f,agency_id:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Agentur wählen…</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plattformen *</label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS_MULTI().map(p => (
                <PlatformIcon key={p} platform={p} size="sm" active={form.platforms.includes(p)}
                  onClick={() => togglePlatform(p)} />
              ))}
            </div>
          </div>
          <Field label="Interne Notizen" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} placeholder="Besonderheiten, Konditionen, Absprachen…" multiline />
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Login-Account *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Login E-Mail *" value={form.login_email} onChange={v => setForm(f=>({...f,login_email:v}))} placeholder="maja@creatorflow.de" type="email" />
              <Field label="Passwort (min. 8 Z.) *" value={form.login_password} onChange={v => setForm(f=>({...f,login_password:v}))} type="password" placeholder="••••••••" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Taucht nach dem Anlegen im Nutzer-Tab auf.</p>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Anlegen…' : 'Anlegen'}
            </button>
          </div>
        </div>
      )}

      {creators.length === 0 && !showForm ? (
        <p className="text-center text-gray-400 text-sm py-12">Noch keine Creator angelegt.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                {c.photo_url ? <img src={c.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">{(c.real_name||'?')[0]}</div>}
                <div>
                  <p className="font-medium text-gray-900 text-sm">{c.real_name}</p>
                  {c.artist_name && <p className="text-xs text-gray-400">{c.artist_name}</p>}
                </div>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {c.platforms?.map(p => <PlatformIcon key={p} platform={p} size="badge" />)}
              </div>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.active ? 'Aktiv' : 'Inaktiv'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Agentur Tab ──────────────────────────────────────────────
function AgenturTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', contact_person:'', email:'', phone:'', website:'', address_street:'', address_city:'', address_zip:'', address_country:'DE', notes:'', login_email:'', login_password:'' })
  const [err, setErr] = useState('')

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies-admin'], queryFn: getAgencies })
  const mutation = useMutation({
    mutationFn: createAgency,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agencies-admin'] }); setShowForm(false) },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Agenturen <span className="text-gray-400 font-normal text-sm">{agencies.length}</span></h2>
        <button onClick={() => setShowForm(v=>!v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Agentur anlegen</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">+ Neue Agentur</h3>
          <Field label="Agenturname *" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Agentur GmbH" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ansprechpartner" value={form.contact_person} onChange={v=>setForm(f=>({...f,contact_person:v}))} />
            <Field label="E-Mail" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email" />
            <Field label="Telefon" value={form.phone} onChange={v=>setForm(f=>({...f,phone:v}))} />
            <Field label="Website" value={form.website} onChange={v=>setForm(f=>({...f,website:v}))} placeholder="https://…" />
          </div>
          <Field label="Interne Notizen" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} multiline />
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Login-Account *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Login E-Mail *" value={form.login_email} onChange={v=>setForm(f=>({...f,login_email:v}))} type="email" />
              <Field label="Passwort (min. 8 Z.) *" value={form.login_password} onChange={v=>setForm(f=>({...f,login_password:v}))} type="password" />
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Anlegen…' : 'Anlegen'}
            </button>
          </div>
        </div>
      )}

      {agencies.length === 0 && !showForm ? (
        <p className="text-center text-gray-400 text-sm py-12">Noch keine Agenturen angelegt.</p>
      ) : (
        <div className="space-y-3">
          {agencies.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{a.name}</p>
                {a.email && <p className="text-sm text-gray-400">{a.email}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.plan}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── System Tab ───────────────────────────────────────────────
function SystemTab() {
  const [level, setLevel] = useState('Alle Level')
  const [source, setSource] = useState('Alle Quellen')
  const { data: summary } = useQuery({ queryKey: ['log-summary'], queryFn: getLogSummary, refetchInterval: 30_000 })
  const { data: logs = [] } = useQuery({ queryKey: ['logs', level, source], queryFn: () => getLogs({ level: level === 'Alle Level' ? undefined : level.toLowerCase(), source: source === 'Alle Quellen' ? undefined : source.toLowerCase() }), refetchInterval: 30_000 })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">System-Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'FEHLER (1H)', value: summary?.error_1h ?? '–', color: summary?.error_1h === 0 ? 'green' : 'red' },
            { label: 'LETZTER JOB', value: summary?.last_job ? new Date(summary.last_job).toLocaleDateString('de') : '–', color: 'gray' },
            { label: 'LETZTE LIEFERUNG', value: summary?.last_delivery ? new Date(summary.last_delivery).toLocaleDateString('de') : '–', color: 'gray' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`text-xl font-bold ${s.color === 'red' ? 'text-red-500' : s.color === 'green' ? 'text-green-500' : 'text-gray-900'}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{summary?.info_24h ?? '–'}</div>
          <div className="text-xs text-green-600 mt-1">Info (24h)</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{summary?.warn_24h ?? '–'}</div>
          <div className="text-xs text-amber-600 mt-1">Warnungen (24h)</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{summary?.error_1h ?? '–'}</div>
          <div className="text-xs text-red-600 mt-1">Fehler (24h)</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['Alle Level','Info','Warn','Error'].map(l => <button key={l} onClick={() => setLevel(l)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${level===l ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{l}</button>)}
        <span className="w-px bg-gray-200 mx-1" />
        {['Alle Quellen','Bot','Api','Cron'].map(s => <button key={s} onClick={() => setSource(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${source===s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{s}</button>)}
      </div>
      {logs.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Keine Logs gefunden.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {logs.map(l => (
            <div key={l.id} className="px-4 py-2.5 flex items-start gap-3 text-xs">
              <span className={`mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded font-medium uppercase ${l.level==='error'?'bg-red-100 text-red-700':l.level==='warn'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>{l.level}</span>
              <span className="text-gray-400 flex-shrink-0">{l.source}</span>
              <span className="text-gray-700 flex-grow">{l.message}</span>
              <span className="text-gray-400 flex-shrink-0">{new Date(l.created_at).toLocaleTimeString('de')}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-gray-400">Automatische Aktualisierung alle 30 Sekunden</p>
    </div>
  )
}

// ── Hilfs-Komponente Field ───────────────────────────────────
function Field({ label, value, onChange, type='text', placeholder='', multiline=false }) {
  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={cls} />
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  )
}

// ── Hauptkomponente ──────────────────────────────────────────
export default function AdminDashboard() {
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

  const tabIcons = { Kreativ: '▶ ', System: '⚙ ' }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        tab={activeTab} week={week} year={year}
        onWeekChange={(w,y) => { setWeek(w); setYear(y) }}
        onLogout={handleLogout}
      />

      {/* Tab-Leiste */}
      <div className="bg-white border-b border-gray-200 sticky top-[69px] z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {(tabIcons[tab] || '') + tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'Aufträge'  && <AuftraegeTab week={week} year={year} />}
        {activeTab === 'Creator'   && <CreatorTab />}
        {activeTab === 'Agentur'   && <AgenturTab />}
        {activeTab === 'Statistik' && <p className="text-center text-gray-400 py-12">Statistik folgt.</p>}
        {activeTab === 'Nutzer'    && <p className="text-center text-gray-400 py-12">Nutzer-Verwaltung folgt.</p>}
        {activeTab === 'System'    && <SystemTab />}
      </div>
    </div>
  )
}
