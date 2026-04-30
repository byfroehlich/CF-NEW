import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getCreators, createCreator, getContentPlans } from '../lib/api.js'
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

const TABS = ['Aufträge', 'Creator', 'Kreativ', 'Statistik']

function AgencyHeader({ tab, week, year, onWeekChange, onLogout }) {
  return (
    <div className="bg-gray-900 text-white px-6 pb-4 sticky top-0 z-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">CF</span>
          </div>
          <div>
            <div className="font-bold text-base leading-none">CreatorFlow</div>
            <div className="text-xs text-gray-400 mt-0.5">AGENTUR</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {['Aufträge', 'Statistik'].includes(tab) && (
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

function AuftraegeTab({ week, year }) {
  const [platform, setPlatform] = useState('Alle')
  const { data: summary } = useQuery({ queryKey: ['summary-agency', week, year], queryFn: () => getJobSummary({ week, year }) })
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs-agency', week, year, platform], queryFn: () => getJobs({ week, year, ...(platform !== 'Alle' && { platform }) }) })

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

function Field({ label, value, onChange, type = 'text', placeholder = '', multiline = false }) {
  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  )
}

function CreatorTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ real_name: '', artist_name: '', contact_email: '', phone: '', birthday: '', platforms: [], notes: '', login_email: '', login_password: '' })
  const [err, setErr] = useState('')

  const { data: creators = [] } = useQuery({ queryKey: ['creators-agency'], queryFn: getCreators })

  const mutation = useMutation({
    mutationFn: createCreator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creators-agency'] })
      setShowForm(false)
      setForm({ real_name: '', artist_name: '', contact_email: '', phone: '', birthday: '', platforms: [], notes: '', login_email: '', login_password: '' })
    },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })

  function togglePlatform(p) {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Meine Creator <span className="text-gray-400 font-normal text-sm">{creators.length}</span></h2>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Creator onboarden</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">+ Neuer Creator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bürgerlicher Name *" value={form.real_name} onChange={v => setForm(f => ({ ...f, real_name: v }))} placeholder="z.B. Maja Schmidt" />
            <Field label="Künstlername" value={form.artist_name} onChange={v => setForm(f => ({ ...f, artist_name: v }))} placeholder="z.B. MajaCurvyOfficial" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-Mail" value={form.contact_email} onChange={v => setForm(f => ({ ...f, contact_email: v }))} type="email" />
            <Field label="Telefon" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+49 …" />
          </div>
          <Field label="Geburtstag" value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} type="date" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plattformen *</label>
            <div className="flex gap-2 flex-wrap">
              {['IG', 'TK', 'OF', 'FL', 'ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="sm" active={form.platforms.includes(p)}
                  onClick={() => togglePlatform(p)} />
              ))}
            </div>
          </div>
          <Field label="Interne Notizen" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} multiline />
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Login-Account *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Login E-Mail *" value={form.login_email} onChange={v => setForm(f => ({ ...f, login_email: v }))} type="email" />
              <Field label="Passwort (min. 8 Z.) *" value={form.login_password} onChange={v => setForm(f => ({ ...f, login_password: v }))} type="password" placeholder="••••••••" />
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

      {creators.length === 0 && !showForm ? (
        <p className="text-center text-gray-400 text-sm py-12">Noch keine Creator angelegt.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                {c.photo_url
                  ? <img src={c.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                  : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">{(c.real_name || '?')[0]}</div>
                }
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

const PLAN_STATUS = { idea: 'Idee', planned: 'Geplant', filming: 'Am Filmen', done: 'Fertig' }
const PLAN_COLORS = { idea: 'bg-gray-100 text-gray-600', planned: 'bg-blue-100 text-blue-700', filming: 'bg-orange-100 text-orange-700', done: 'bg-green-100 text-green-700' }

function KreativTab({ week, year }) {
  const [platform, setPlatform] = useState('Alle')

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans-agency', week, year, platform],
    queryFn: () => getContentPlans({ week, year, ...(platform !== 'Alle' && { platform }) })
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900 mb-1">Kreativ-Pläne</h2>
        <p className="text-xs text-gray-400">Nur freigegebene Pläne der Creator</p>
      </div>

      <PlatformFilter value={platform} onChange={setPlatform} dark />

      {isLoading ? (
        <p className="text-center text-gray-400 text-sm py-12">Lädt…</p>
      ) : plans.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Keine freigegebenen Pläne für KW{week}.</p>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 space-y-2 ${p.carried_over_from ? 'border-amber-200' : 'border-gray-200'}`}>
              {/* Übertrag-Banner */}
              {p.carried_over_from && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                  <span>↩</span>
                  <span className="font-semibold">Übertrag aus vorheriger Woche</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlatformIcon platform={p.platform} size="badge" />
                    <span className="text-xs text-gray-400">{p.artist_name || p.real_name}</span>
                    {p.pushed_to_week && (
                      <span className="text-xs text-indigo-400 font-medium">→ KW{p.pushed_to_week} geschoben</span>
                    )}
                  </div>
                  {p.title && <p className="text-sm font-semibold text-gray-900 mt-0.5">{p.title}</p>}
                  {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-3">{p.description}</p>}
                </div>
                <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[p.status]}`}>
                  {PLAN_STATUS[p.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgencyDashboard() {
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
      <AgencyHeader
        tab={activeTab} week={week} year={year}
        onWeekChange={(w, y) => { setWeek(w); setYear(y) }}
        onLogout={handleLogout}
      />

      <div className="bg-white border-b border-gray-200 sticky top-[69px] z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'Aufträge'  && <AuftraegeTab week={week} year={year} />}
        {activeTab === 'Creator'   && <CreatorTab />}
        {activeTab === 'Kreativ'   && <KreativTab week={week} year={year} />}
        {activeTab === 'Statistik' && <p className="text-center text-gray-400 py-12">Statistik folgt.</p>}
      </div>
    </div>
  )
}
