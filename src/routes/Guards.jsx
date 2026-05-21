import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader } from '../components/ui/Loader'

export const ProtectedRoute = () => {
  const { user, loading } = useAuth()
  if (loading) return <Loader fullScreen />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export const RoleBasedRoute = ({ allowedRoles }) => {
  const { userProfile, loading } = useAuth()
  if (loading) return <Loader fullScreen />
  if (!userProfile) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(userProfile.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export const GuestRoute = () => {
  const { user, loading } = useAuth()
  if (loading) return <Loader fullScreen />
  return !user ? <Outlet /> : <Navigate to="/dashboard" replace />
}
