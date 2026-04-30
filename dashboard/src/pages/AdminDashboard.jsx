import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout, getJobs, getJobSummary, getCreators, getAgencies, createCreator, updateCreator, createAgency, updateAgency, getLogs, getLogSummary, getCreatorPhotos, uploadFile, addCreatorPhoto, deleteCreatorPhoto, activateCreator, rejectCreator, getSystemSettings, updateSystemSetting } from '../lib/api.js'
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

const ACTIVATION_BADGE = {
  pending:'bg-gray-100 text-gray-500', id_uploaded:'bg-blue-100 text-blue-700',
  ai_checked:'bg-violet-100 text-violet-700', agency_confirmed:'bg-amber-100 text-amber-700',
  active:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700',
}
const ACTIVATION_LABEL = {
  pending:'Ausstehend', id_uploaded:'Ausweis hoch', ai_checked:'KI geprüft',
  agency_confirmed:'Bestätigt', active:'Freigeschaltet', rejected:'Abgelehnt',
}

// ── Foto-Upload Sektion (Admin + Agency) ─────────────────────
function PhotoLightbox({ url, onClose, onDelete, deleting }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <img src={url} className="w-full max-h-[80vh] object-contain rounded-xl" alt="" />
        <div className="flex gap-2 mt-3 justify-end">
          <a href={url} download target="_blank" rel="noreferrer"
            className="px-3 py-1.5 bg-white text-gray-800 text-xs font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Speichern
          </a>
          {onDelete && (
            <button onClick={onDelete} disabled={deleting}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">
              {deleting ? '…' : 'Löschen'}
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-700 text-white text-xs font-medium rounded-lg hover:bg-gray-600">Schließen</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PhotoUploadSection({ label, photos, type, max, creatorId, onUploaded, accept = 'image/*' }) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const { url } = await uploadFile(file, type === 'id_document' ? 'id_document' : 'photo')
      await addCreatorPhoto(creatorId, { url, type })
      onUploaded()
    } catch (err) {
      alert('Upload fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setUploading(false) }
  }

  async function handleDelete(photoId) {
    setDeletingId(photoId)
    try {
      await deleteCreatorPhoto(creatorId, photoId)
      setLightbox(null)
      onUploaded()
    } catch (err) {
      alert('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setDeletingId(null) }
  }

  return (
    <div>
      {lightbox && (
        <PhotoLightbox
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDelete={() => handleDelete(lightbox.id)}
          deleting={deletingId === lightbox.id}
        />
      )}
      <p className="text-xs text-gray-400 mb-1.5">{label} ({photos.length}/{max})</p>
      <div className="flex gap-2 flex-wrap items-center">
        {photos.map(p => (
          <div key={p.id} className="relative group w-16 h-16 cursor-pointer" onClick={() => setLightbox(p)}>
            <img src={p.url} className="w-16 h-16 rounded-lg object-cover border border-gray-200" alt="" />
            <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>
        ))}
        {photos.length < max && (
          <label className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'}`}>
            {uploading
              ? <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              : <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            }
            <input type="file" accept={accept} className="sr-only" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Admin Creator Card ───────────────────────────────────────
function AdminCreatorCard({ c, agencies, qc }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [profileLightbox, setProfileLightbox] = useState(false)

  const age = c.birthday ? Math.floor((Date.now() - new Date(c.birthday)) / 31557600000) : null
  const agencyName = agencies.find(a => a.id === c.agency_id)?.name
  const needsActivation = ['pending','id_uploaded','ai_checked'].includes(c.activation_status)

  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['creator-photos-admin', c.id],
    queryFn: () => getCreatorPhotos(c.id),
    enabled: expanded
  })

  const activateMut = useMutation({
    mutationFn: () => activateCreator(c.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creators-admin'] }),
    onError: e => alert(e.response?.data?.error || 'Fehler beim Freischalten')
  })
  const rejectMut = useMutation({
    mutationFn: () => rejectCreator(c.id, rejectReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creators-admin'] }); setRejectOpen(false) },
    onError: e => alert(e.response?.data?.error || 'Fehler')
  })
  const editMut = useMutation({
    mutationFn: data => updateCreator(c.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creators-admin'] }); setEditing(false) },
    onError: e => alert(e.response?.data?.error || 'Fehler beim Speichern')
  })

  async function handleProfilePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingPhoto(true)
    try {
      const { url } = await uploadFile(file, 'photo')
      await addCreatorPhoto(c.id, { url, type: 'profile' })
      qc.invalidateQueries({ queryKey: ['creators-admin'] })
      refetchPhotos()
    } catch(err) {
      alert('Upload fehlgeschlagen: ' + (err.response?.data?.error || err.message))
    } finally { setUploadingPhoto(false) }
  }

  function openEdit() {
    setEditForm({ agency_id:c.agency_id||'', real_name:c.real_name||'', artist_name:c.artist_name||'', contact_email:c.contact_email||'', phone:c.phone||'', birthday:c.birthday?.slice(0,10)||'', notes:c.notes||'', platforms:[...(c.platforms||[])], telegram_chat_id:c.telegram_chat_id||'', billing_party:c.billing_party||'agency' })
    setEditing(true)
  }

  const profilePhoto = photos.find(p => p.type === 'profile')
  const displayPhoto = profilePhoto?.url || c.photo_url
  const rolePhotos   = photos.filter(p => p.type === 'role')
  const idPhotos     = photos.filter(p => p.type === 'id_document')

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 ${needsActivation ? 'border-blue-200' : 'border-gray-200'}`}>
      {profileLightbox && displayPhoto && (
        <PhotoLightbox url={displayPhoto} onClose={() => setProfileLightbox(false)} />
      )}
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 group">
          {displayPhoto
            ? <img src={displayPhoto} className="w-16 h-16 rounded-xl object-cover cursor-pointer" onClick={() => setProfileLightbox(true)} alt="" />
            : <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-xl">{(c.real_name||'?')[0]}</div>
          }
          <label className={`absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center cursor-pointer transition-opacity ${uploadingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {uploadingPhoto
              ? <svg className="w-3.5 h-3.5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              : <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            }
            <input type="file" accept="image/*" className="sr-only" onChange={handleProfilePhoto} disabled={uploadingPhoto} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{c.real_name}</p>
              {c.artist_name && <p className="text-xs text-violet-500 font-medium">@{c.artist_name}</p>}
              {agencyName && <p className="text-xs text-gray-400">{agencyName}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={openEdit} className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onClick={() => setExpanded(v => !v)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {c.platforms?.map(p => <PlatformIcon key={p} platform={p} size="badge" />)}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTIVATION_BADGE[c.activation_status] || 'bg-gray-100 text-gray-500'}`}>
              {ACTIVATION_LABEL[c.activation_status] || 'Ausstehend'}
            </span>
            {age !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${age < 18 ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {age}J {age < 18 ? '⚠' : '✓18+'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Aktivierung */}
      {needsActivation && !editing && (
        <div className="pt-1">
          {rejectOpen ? (
            <div className="space-y-2">
              <input placeholder="Ablehnungsgrund" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400" />
              <div className="flex gap-2">
                <button onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}
                  className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">Ablehnen</button>
                <button onClick={() => setRejectOpen(false)} className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg">Abbrechen</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => activateMut.mutate()} disabled={activateMut.isPending}
                className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                {activateMut.isPending ? '…' : '✓ Freischalten'}
              </button>
              <button onClick={() => setRejectOpen(true)} className="flex-1 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50">
                ✕ Ablehnen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit */}
      {editing && editForm && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bearbeiten</p>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Agentur</label>
            <select value={editForm.agency_id} onChange={e => setEditForm(f=>({...f,agency_id:e.target.value}))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">— keine —</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {[['real_name','Bürgerlicher Name','text'],['artist_name','Künstlername','text'],['contact_email','E-Mail','email'],['phone','Telefon','tel'],['telegram_chat_id','Telegram Chat ID','text']].map(([key,label,type]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
              <input type={type} value={editForm[key]||''} onChange={e => setEditForm(f=>({...f,[key]:e.target.value}))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Geburtstag</label>
            <input type="date" value={editForm.birthday} onChange={e => setEditForm(f=>({...f,birthday:e.target.value}))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Plattformen</label>
            <div className="flex gap-1.5 flex-wrap">
              {['IG','TK','OF','FL','ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="sm" active={editForm.platforms.includes(p)}
                  onClick={() => setEditForm(f=>({...f,platforms:f.platforms.includes(p)?f.platforms.filter(x=>x!==p):[...f.platforms,p]}))} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Abrechnung</label>
            <div className="flex gap-2">
              {[['agency','Agentur zahlt'],['creator','Creator zahlt']].map(([val,label]) => (
                <button key={val} type="button" onClick={() => setEditForm(f=>({...f,billing_party:val}))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editForm.billing_party===val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Notizen (intern)</label>
            <textarea rows={2} value={editForm.notes} onChange={e => setEditForm(f=>({...f,notes:e.target.value}))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={() => editMut.mutate({
                ...editForm,
                agency_id: editForm.agency_id || null,
                telegram_chat_id: editForm.telegram_chat_id ? parseInt(editForm.telegram_chat_id) : null,
                birthday: editForm.birthday || null,
              })} disabled={editMut.isPending}
              className="flex-1 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {editMut.isPending ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && !editing && (
        <div className="border-t border-gray-100 pt-3 space-y-3 text-xs text-gray-500">
          {c.contact_email && <div className="flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>{c.contact_email}</div>}
          {c.phone && <div className="flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>{c.phone}</div>}
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            {c.telegram_chat_id ? <span className="text-green-600">Telegram: {c.telegram_chat_id}</span> : <span className="text-gray-400">Telegram ausstehend</span>}
          </div>
          {c.billing_party && <div className="text-xs text-gray-400">Abrechnung: <span className="font-medium text-gray-600">{c.billing_party === 'agency' ? 'Agentur' : 'Creator'}</span></div>}
          {c.notes && <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-xs text-gray-500 italic">{c.notes}</div>}

          <PhotoUploadSection label="Rollenfotos" photos={rolePhotos} type="role" max={5} creatorId={c.id} onUploaded={refetchPhotos} />
          <PhotoUploadSection label="Ausweisdokumente" photos={idPhotos} type="id_document" max={2} creatorId={c.id} onUploaded={refetchPhotos} accept="image/*,.pdf" />
          <p className="text-gray-300">seit {new Date(c.created_at).toLocaleDateString('de')}</p>
        </div>
      )}
    </div>
  )
}

// ── Creator Tab ──────────────────────────────────────────────
function CreatorTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ real_name:'', artist_name:'', contact_email:'', phone:'', birthday:'', platforms:[], notes:'', agency_id:'', login_email:'', login_password:'' })
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')

  const { data: creators = [] } = useQuery({ queryKey: ['creators-admin'], queryFn: getCreators })
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies-admin'], queryFn: getAgencies })

  const mutation = useMutation({
    mutationFn: createCreator,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['creators-admin'] }); setShowForm(false); setForm({ real_name:'',artist_name:'',contact_email:'',phone:'',birthday:'',platforms:[],notes:'',agency_id:'',login_email:'',login_password:'' }) },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })

  const filtered = creators.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (c.real_name||'').toLowerCase().includes(s) || (c.artist_name||'').toLowerCase().includes(s)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Creator-Kartei <span className="text-gray-400 font-normal text-sm">{creators.length}</span></h2>
        <button onClick={() => setShowForm(v=>!v)} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Creator onboarden</button>
      </div>

      <input type="search" placeholder="Nach Name suchen…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">+ Neuer Creator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bürgerlicher Name *" value={form.real_name} onChange={v=>setForm(f=>({...f,real_name:v}))} placeholder="z.B. Maja Schmidt" />
            <Field label="Künstlername" value={form.artist_name} onChange={v=>setForm(f=>({...f,artist_name:v}))} placeholder="z.B. MajaCurvyOfficial" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-Mail" value={form.contact_email} onChange={v=>setForm(f=>({...f,contact_email:v}))} placeholder="maja@example.com" type="email" />
            <Field label="Telefon" value={form.phone} onChange={v=>setForm(f=>({...f,phone:v}))} placeholder="+49 …" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Geburtstag" value={form.birthday} onChange={v=>setForm(f=>({...f,birthday:v}))} type="date" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agentur *</label>
              <select value={form.agency_id} onChange={e=>setForm(f=>({...f,agency_id:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Agentur wählen…</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plattformen *</label>
            <div className="flex gap-2 flex-wrap">
              {['IG','TK','OF','FL','ML'].map(p => (
                <PlatformIcon key={p} platform={p} size="sm" active={form.platforms.includes(p)}
                  onClick={() => setForm(f=>({...f,platforms:f.platforms.includes(p)?f.platforms.filter(x=>x!==p):[...f.platforms,p]}))} />
              ))}
            </div>
          </div>
          <Field label="Interne Notizen" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="Besonderheiten…" multiline />
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Login-Account *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Login E-Mail *" value={form.login_email} onChange={v=>setForm(f=>({...f,login_email:v}))} placeholder="maja@creatorflow.de" type="email" />
              <Field label="Passwort (min. 8 Z.) *" value={form.login_password} onChange={v=>setForm(f=>({...f,login_password:v}))} type="password" placeholder="••••••••" />
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

      {filtered.length === 0 && !showForm ? (
        <p className="text-center text-gray-400 text-sm py-12">{search ? 'Kein Creator gefunden.' : 'Noch keine Creator angelegt.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => <AdminCreatorCard key={c.id} c={c} agencies={agencies} qc={qc} />)}
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
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies-admin'], queryFn: getAgencies })
  const mutation = useMutation({
    mutationFn: createAgency,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agencies-admin'] }); setShowForm(false); setForm({ name:'',contact_person:'',email:'',phone:'',website:'',address_street:'',address_city:'',address_zip:'',address_country:'DE',notes:'',login_email:'',login_password:'' }) },
    onError: e => setErr(e.response?.data?.error || 'Fehler beim Anlegen')
  })
  const editMut = useMutation({
    mutationFn: ({ id, ...data }) => updateAgency(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agencies-admin'] }); setEditId(null) },
    onError: e => alert(e.response?.data?.error || 'Fehler beim Speichern')
  })

  function openEdit(a) {
    setEditForm({ name:a.name||'', contact_person:a.contact_person||'', email:a.email||'', phone:a.phone||'', website:a.website||'', notes:a.notes||'', company_type:a.company_type||'other', tax_id:a.tax_id||'', billing_email:a.billing_email||'' })
    setEditId(a.id)
  }

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
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              {editId === a.id && editForm ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bearbeiten</p>
                  {[['name','Agenturname *','text'],['contact_person','Ansprechpartner','text'],['email','E-Mail','email'],['phone','Telefon','tel'],['website','Website','url'],['billing_email','Rechnungs-E-Mail','email'],['tax_id','Steuernummer','text']].map(([key,label,type]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
                      <input type={type} value={editForm[key]||''} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Unternehmensform</label>
                    <select value={editForm.company_type} onChange={e=>setEditForm(f=>({...f,company_type:e.target.value}))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {[['gmbh','GmbH'],['ug','UG'],['einzelunternehmen','Einzelunternehmen'],['gbr','GbR'],['other','Sonstige']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Interne Notizen</label>
                    <textarea rows={2} value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditId(null)} className="flex-1 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50">Abbrechen</button>
                    <button onClick={() => editMut.mutate({ id: a.id, ...editForm })} disabled={editMut.isPending}
                      className="flex-1 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {editMut.isPending ? 'Speichern…' : 'Speichern'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{a.name}</p>
                    {a.email && <p className="text-sm text-gray-400">{a.email}</p>}
                    {a.contact_person && <p className="text-xs text-gray-400">{a.contact_person}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.plan}</span>
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── System Tab ───────────────────────────────────────────────
function SystemTab() {
  const qc = useQueryClient()
  const [level, setLevel] = useState('Alle Level')
  const [source, setSource] = useState('Alle Quellen')
  const { data: summary } = useQuery({ queryKey: ['log-summary'], queryFn: getLogSummary, refetchInterval: 30_000 })
  const { data: logs = [] } = useQuery({ queryKey: ['logs', level, source], queryFn: () => getLogs({ level: level === 'Alle Level' ? undefined : level.toLowerCase(), source: source === 'Alle Quellen' ? undefined : source.toLowerCase() }), refetchInterval: 30_000 })
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSystemSettings })

  const settingMut = useMutation({
    mutationFn: ({ key, value }) => updateSystemSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-settings'] }),
    onError: e => alert('Einstellung konnte nicht gespeichert werden: ' + (e.response?.data?.error || e.message))
  })

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

      {/* System-Einstellungen */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Einstellungen</p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Ausweis-Verifikation erforderlich</p>
              <p className="text-xs text-gray-400">Wenn aus, können Creator ohne Ausweis-Upload freigeschaltet werden (Testmodus).</p>
            </div>
            <button
              onClick={() => settingMut.mutate({ key: 'require_id_verification', value: !settings?.require_id_verification })}
              disabled={settingMut.isPending}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${!!settings?.require_id_verification ? 'bg-indigo-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${!!settings?.require_id_verification ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
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
