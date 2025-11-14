import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const useLogout = () => {
  const navigate = useNavigate()
  const { logout: contextLogout } = useAuth()
  const [loading, setLoading] = useState(false)

  const logout = useCallback(async () => {
    setLoading(true)

    try {
      // Call centralized logout (clears cookie & context)
      contextLogout()

      // Optionally clear any extra localStorage items
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')

      navigate('/')
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoading(false)
    }
  }, [contextLogout, navigate])

  return { logout, loading }
}

export default useLogout
