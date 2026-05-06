import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE}/api/v1/auth/refresh`, { refresh_token: refresh })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export const login = (email, password) =>
  api.post('/api/v1/auth/login', { email, password }).then(r => r.data)

export const logout = () => {
  const refresh_token = localStorage.getItem('refresh_token')
  return api.post('/api/v1/auth/logout', { refresh_token }).finally(() => localStorage.clear())
}

// Jobs
export const getJobs = params => api.get('/api/v1/jobs', { params }).then(r => r.data)
export const getJobSummary = params => api.get('/api/v1/jobs/summary', { params }).then(r => r.data)
export const getJobStats   = params => api.get('/api/v1/jobs/stats',   { params }).then(r => r.data)
export const updateJobStatus = (id, status, note) =>
  api.patch(`/api/v1/jobs/${id}/status`, { status, note }).then(r => r.data)
export const createJob = data => api.post('/api/v1/jobs', data).then(r => r.data)

// Creators
export const getCreators = params => api.get('/api/v1/creators', { params }).then(r => r.data)
export const getCreator = id => api.get(`/api/v1/creators/${id}`).then(r => r.data)
export const getMyProfile = () => api.get('/api/v1/creators/me').then(r => r.data)
export const createCreator = data => api.post('/api/v1/creators', data).then(r => r.data)
export const updateCreator = (id, data) => api.patch(`/api/v1/creators/${id}`, data).then(r => r.data)
export const activateCreator = id => api.patch(`/api/v1/creators/${id}/activate`).then(r => r.data)
export const rejectCreator = (id, reason) => api.patch(`/api/v1/creators/${id}/reject`, { reason }).then(r => r.data)
export const getPendingCreators = () => api.get('/api/v1/creators/pending-activation').then(r => r.data)

// Creator Photos
export const getCreatorPhotos = creatorId =>
  api.get(`/api/v1/creators/${creatorId}/photos`).then(r => r.data)
export const addCreatorPhoto = (creatorId, data) =>
  api.post(`/api/v1/creators/${creatorId}/photos`, data).then(r => r.data)
export const deleteCreatorPhoto = (creatorId, photoId) =>
  api.delete(`/api/v1/creators/${creatorId}/photos/${photoId}`).then(r => r.data)
export const updateCreatorPhotoMeta = (creatorId, photoId, data) =>
  api.patch(`/api/v1/creators/${creatorId}/photos/${photoId}`, data).then(r => r.data)

// File Upload (multipart)
export const uploadFile = (file, type = 'photo') => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/v1/upload?type=${type}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => ({
    ...r.data,
    url: r.data.url.startsWith('/') ? `${BASE}${r.data.url}` : r.data.url
  }))
}

// Agencies
export const getAgencies = () => api.get('/api/v1/agencies').then(r => r.data)
export const getAgency = id => api.get(`/api/v1/agencies/${id}`).then(r => r.data)
export const createAgency = data => api.post('/api/v1/agencies', data).then(r => r.data)
export const updateAgency = (id, data) => api.patch(`/api/v1/agencies/${id}`, data).then(r => r.data)

// Creator Accounts
export const getCreatorAccounts = () => api.get('/api/v1/creator-accounts').then(r => r.data)
export const createCreatorAccount = data => api.post('/api/v1/creator-accounts', data).then(r => r.data)
export const deleteCreatorAccount = id => api.delete(`/api/v1/creator-accounts/${id}`).then(r => r.data)

// Content Plans
export const getContentPlans = params => api.get('/api/v1/content-plans', { params }).then(r => r.data)
export const createContentPlan = data => api.post('/api/v1/content-plans', data).then(r => r.data)
export const updateContentPlan = (id, data) => api.patch(`/api/v1/content-plans/${id}`, data).then(r => r.data)
export const deleteContentPlan = id => api.delete(`/api/v1/content-plans/${id}`).then(r => r.data)
export const getContentPlanStats = params => api.get('/api/v1/content-plans/stats', { params }).then(r => r.data)

// Logs
export const getLogs = params => api.get('/api/v1/logs', { params }).then(r => r.data)
export const getLogSummary = () => api.get('/api/v1/logs/summary').then(r => r.data)

// Change Requests
export const getChangeRequests   = ()          => api.get('/api/v1/change-requests').then(r => r.data)
export const createChangeRequest = data        => api.post('/api/v1/change-requests', data).then(r => r.data)
export const reviewChangeRequest = (id, data)  => api.patch(`/api/v1/change-requests/${id}`, data).then(r => r.data)
export const updateMyPhoto = photo_url         => api.patch('/api/v1/creators/me/photo', { photo_url }).then(r => r.data)

// System Settings
export const getSystemSettings    = ()            => api.get('/api/v1/system/settings').then(r => r.data)
export const updateSystemSetting  = (key, value)  => api.patch(`/api/v1/system/settings/${key}`, { value }).then(r => r.data)

export default api
