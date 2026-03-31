import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange, getUserProfile, logoutUser } from '../services/authService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid)
          
          // Check if profile exists and is approved
          if (profile && profile.status === 'approved') {
            // Ensure role is set (default to 'user' if missing)
            const userWithDefaults = {
              ...profile,
              role: profile.role || 'user'
            }
            setUser(firebaseUser)
            setUserProfile(userWithDefaults)
          } else if (profile && profile.status === 'pending') {
            // User is still pending, logout
            await logoutUser()
            setUser(null)
            setUserProfile(null)
          } else if (profile && profile.status === 'rejected') {
            // User is rejected, logout
            await logoutUser()
            setUser(null)
            setUserProfile(null)
          } else {
            // Profile not found or invalid, logout
            await logoutUser()
            setUser(null)
            setUserProfile(null)
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
          await logoutUser()
          setUser(null)
          setUserProfile(null)
        }
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const logout = async () => {
    await logoutUser()
    setUser(null)
    setUserProfile(null)
  }

  const refreshProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.uid)
      if (profile && profile.status === 'approved') {
        setUserProfile({
          ...profile,
          role: profile.role || 'user'
        })
      }
    }
  }

  const isSuperAdmin = userProfile?.role === 'superadmin'
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin
  const isUser = !!userProfile

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile, isSuperAdmin, isAdmin, isUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
