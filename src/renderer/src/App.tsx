import { useState, useEffect, useCallback } from 'react'
import LoginPage from './pages/Login'
import SetupPage from './pages/Setup'
import RegisterPage from './pages/Register'
import WorkbenchPage from './pages/workbench/Workbench'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  useEffect(() => {
    async function init() {
      try {
        const exists = await window.harbor.invoke<boolean>('auth:hasUsers')
        setHasUsers(exists)

        if (exists) {
          const savedId = localStorage.getItem('harbor_userId')
          if (savedId) {
            const u = await window.harbor.invoke<User | null>('auth:getCurrentUser', savedId)
            if (u) setUser(u)
          }
        }
      } catch (err) {
        console.error('[App] Failed to check users:', err)
        setHasUsers(false)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleLogin = useCallback((u: User) => {
    localStorage.setItem('harbor_userId', u.id)
    setUser(u)
    setHasUsers(true)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('harbor_userId')
    setUser(null)
  }, [])

  if (loading || hasUsers === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-harbor-200 border-t-harbor-600" />
      </div>
    )
  }

  if (!hasUsers) {
    return <SetupPage onSetup={handleLogin} />
  }

  if (!user) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={handleLogin}
          onBackToLogin={() => setAuthView('login')}
        />
      )
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoToRegister={() => setAuthView('register')}
      />
    )
  }

  return <WorkbenchPage user={user} onLogout={handleLogout} />
}
