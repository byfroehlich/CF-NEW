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

// Agencies
export const getAgencies = () => api.get('/api/v1/agencies').then(r => r.data)
export const getAgency = id => api.get(`/api/v1/agencies/${id}`).then(r => r.data)
export const createAgency = data => api.post('/api/v1/agencies', data).then(r => r.data)
export const updateAgency = (id, data) => api.patch(`/api/v1/agencies/${id}`, data).then(r => r.data)

// Content Plans
export const getContentPlans = params => api.get('/api/v1/content-plans', { params }).then(r => r.data)
export const createContentPlan = data => api.post('/api/v1/content-plans', data).then(r => r.data)
export const updateContentPlan = (id, data) => api.patch(`/api/v1/content-plans/${id}`, data).then(r => r.data)
export const deleteContentPlan = id => api.delete(`/api/v1/content-plans/${id}`).then(r => r.data)

// Logs
export const getLogs = params => api.get('/api/v1/logs', { params }).then(r => r.data)
export const getLogSummary = () => api.get('/api/v1/logs/summary').then(r => r.data)

export default api
