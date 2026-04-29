export const getRole   = () => localStorage.getItem('role')
export const getToken  = () => localStorage.getItem('access_token')
export const isLoggedIn = () => !!getToken()

export function saveAuth(data) {
  localStorage.setItem('access_token',  data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('role',          data.role)
  if (data.creator_id) localStorage.setItem('creator_id', data.creator_id)
  if (data.agency_id)  localStorage.setItem('agency_id',  data.agency_id)
}

export function clearAuth() {
  localStorage.clear()
}

export function roleHome() {
  const role = getRole()
  if (role === 'admin')   return '/admin'
  if (role === 'agency')  return '/agentur'
  if (role === 'creator') return '/creator'
  return '/login'
}
