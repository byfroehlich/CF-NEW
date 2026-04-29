import { Navigate } from 'react-router-dom'
import { getToken, getRole } from './auth.js'

export default function ProtectedRoute({ children, allowedRoles }) {
  if (!getToken()) return <Navigate to="/login" replace />
  const role = getRole()
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/login" replace />
  return children
}
