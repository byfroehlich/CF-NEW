import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getCreators, createCreator, getContentPlans, getChangeRequests, reviewChangeRequest, updateCreatorPhoto } from '../lib/api.js'
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
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  const { data: creators = [] } = useQuery({ queryKey: ['creators-agency'], queryFn: getCreators })
  const { data: changeRequests = [] } = useQuery({ queryKey: ['change-requests-agency'], queryFn: getChangeRequests })
  const pendingRequests = changeRequests.filter(r => r.status === 'pending')

  const mutation = useMutation({
    mutationFn: createCreator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creators-agency'] })
      setShowForm(false)
      setForm({ real_name: '', artist_name: '', contact_email: '', phone: '', birthday: '', platforms: [], notes: '', login_email: '', login_password: '' })
    },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, status, note }) => reviewChangeRequest(id, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests-agency'] })
      qc.invalidateQueries({ queryKey: ['creators-agency'] })
      setRejectId(null); setRejectNote('')
    },
    onError: e => alert('Fehler: ' + (e.response?.data?.error || e.message))
  })

  const photoMut = useMutation({
    mutationFn: ({ id, photo_url }) => updateCreatorPhoto(id, photo_url),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creators-agency'] }),
    onError: e => alert('Foto-Upload fehlgeschlagen: ' + (e.response?.data?.error || e.message))
  })

  async function handlePhotoUpload(creatorId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file, 400)
      photoMut.mutate({ id: creatorId, photo_url: dataUrl })
    } catch { alert('Bild konnte nicht verarbeitet werden') }
  }

  function togglePlatform(p) {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          Meine Creator <span className="text-gray-400 font-normal text-sm">{creators.length}</span>
          {pendingRequests.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingRequests.length}</span>
          )}
        </h2>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Creator onboarden</button>
      </div>

      {/* Offene Änderungsanfragen */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Offene Anfragen</p>
          {pendingRequests.map(r => (
            <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">{r.artist_name || r.real_name}</p>
                <span className="text-xs text-gray-400">{new Date(r.requested_at).toLocaleDateString('de')}</span>
              </div>
              <div className="space-y-1.5 mb-3">
                {Object.entries(r.fields).map(([key, val]) => (
                  <div key={key} className="text-xs text-gray-600">
                    <span className="font-medium">{FIELD_LABELS[key] || key}:</span>{' '}
                    <span className="text-gray-400 line-through">{Array.isArray(val.old) ? val.old.join(', ') : (val.old || '–')}</span>
                    {' → '}
                    <span className="text-gray-900 font-medium">{Array.isArray(val.new) ? val.new.join(', ') : (val.new || '–')}</span>
                  </div>
                ))}
              </div>
              {rejectId === r.id ? (
                <div className="space-y-2">
                  <input placeholder="Ablehnungsgrund (optional)" value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <div className="flex gap-2">
                    <button onClick={() => reviewMut.mutate({ id: r.id, status: 'rejected', note: rejectNote })}
                      disabled={reviewMut.isPending}
                      className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">
                      Ablehnen bestätigen
                    </button>
                    <button onClick={() => { setRejectId(null); setRejectNote('') }}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50">
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => reviewMut.mutate({ id: r.id, status: 'approved' })}
                    disabled={reviewMut.isPending}
                    className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                    ✓ Genehmigen
                  </button>
                  <button onClick={() => setRejectId(r.id)}
                    className="flex-1 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50">
                    ✕ Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
          {creators.map(c => {
            const age = c.birthday ? Math.floor((Date.now() - new Date(c.birthday)) / 31557600000) : null
            return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              {/* Header: Avatar + Namen */}
              <div className="flex items-center gap-3">
                <label className="relative cursor-pointer group flex-shrink-0">
                  {c.photo_url
                    ? <img src={c.photo_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                    : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-base">{(c.real_name || '?')[0]}</div>
                  }
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {photoMut.isPending && photoMut.variables?.id === c.id
                      ? <span className="text-white text-xs">…</span>
                      : <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    }
                  </div>
                  <input type="file" accept="image/*" className="sr-only" onChange={e => handlePhotoUpload(c.id, e)} />
                </label>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{c.real_name}</p>
                  {c.artist_name && <p className="text-xs text-violet-500 font-medium mt-0.5">@{c.artist_name}</p>}
                </div>
              </div>

              {/* Plattformen */}
              <div className="flex gap-1.5 flex-wrap">
                {c.platforms?.map(p => <PlatformIcon key={p} platform={p} size="badge" />)}
              </div>

              {/* Kontakt-Infos */}
              <div className="space-y-1 text-xs text-gray-500">
                {c.contact_email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    <span className="truncate">{c.contact_email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <span>{c.phone}</span>
                  </div>
                )}
                {age !== null && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span>{age} Jahre</span>
                    {age < 18 && <span className="text-red-600 font-semibold">⚠ Minderjährig</span>}
                    {age >= 18 && <span className="text-green-600">✓ 18+</span>}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  {c.telegram_chat_id
                    ? <span className="text-green-600">Telegram verknüpft</span>
                    : <span className="text-gray-400">Telegram ausstehend</span>
                  }
                </div>
              </div>

              {/* Notizen (wenn vorhanden) */}
              {c.notes && (
                <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-xs text-gray-500 italic">
                  {c.notes}
                </div>
              )}

              {/* Footer: Status-Badges */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.active ? 'Aktiv' : 'Inaktiv'}</span>
                {changeRequests.some(r => r.creator_id === c.id && r.status === 'pending') && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Anfrage</span>
                )}
                <span className="text-xs text-gray-300 ml-auto">seit {new Date(c.created_at).toLocaleDateString('de')}</span>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PLAN_STATUS = { idea: 'Idee', planned: 'Geplant', filming: 'Am Filmen', done: 'Fertig' }
const PLAN_COLORS = { idea: 'bg-gray-100 text-gray-600', planned: 'bg-blue-100 text-blue-700', filming: 'bg-orange-100 text-orange-700', done: 'bg-green-100 text-green-700' }
const FIELD_LABELS = { artist_name: 'Künstlername', photo_url: 'Foto', contact_email: 'E-Mail', phone: 'Telefon', platforms: 'Plattformen' }

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
