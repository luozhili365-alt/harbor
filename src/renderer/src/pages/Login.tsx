import { useState, FormEvent } from 'react'

interface LoginPageProps {
  onLogin: (user: { id: string; name: string; email: string; role: string }) => void
  onGoToRegister?: () => void
}

const EMAIL_DOMAINS = [
  { label: '@qq.com', value: '@qq.com' },
  { label: '@163.com', value: '@163.com' },
  { label: '@126.com', value: '@126.com' },
  { label: '@gmail.com', value: '@gmail.com' },
  { label: '@outlook.com', value: '@outlook.com' },
  { label: '@hotmail.com', value: '@hotmail.com' },
  { label: '@sina.com', value: '@sina.com' },
  { label: '@aliyun.com', value: '@aliyun.com' },
  { label: '@foxmail.com', value: '@foxmail.com' },
  { label: '@yeah.net', value: '@yeah.net' },
  { label: '自定义', value: '__custom__' }
]

export default function LoginPage({ onLogin, onGoToRegister }: LoginPageProps) {
  const [emailPrefix, setEmailPrefix] = useState('')
  const [emailDomain, setEmailDomain] = useState('@qq.com')
  const [customDomain, setCustomDomain] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const fullEmail =
    emailDomain === '__custom__'
      ? emailPrefix + customDomain
      : emailPrefix + emailDomain

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await window.harbor.invoke<{
        success: boolean
        error?: string
        user?: { id: string; name: string; email: string; role: string }
      }>('auth:login', fullEmail.trim(), password)

      if (result.success && result.user) {
        onLogin(result.user)
      } else {
        setError(result.error || '登录失败')
      }
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-harbor-600 text-white text-2xl font-bold shadow-lg shadow-harbor-200">
            H
          </div>
          <h1 className="text-xl font-bold text-gray-900">Harbor</h1>
          <p className="mt-1 text-sm text-gray-500">报关AI工作台</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <h2 className="mb-6 text-sm font-semibold text-gray-700">登录账号</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">邮箱</label>
              <div className="flex gap-0">
                <input
                  type="text"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                  className="flex-1 rounded-l-lg border border-r-0 border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors"
                  placeholder="输入邮箱地址"
                  required
                  autoFocus
                />
                {emailDomain === '__custom__' ? (
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-40 rounded-r-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors"
                    placeholder="@your-company.com"
                    required
                  />
                ) : (
                  <select
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                    className="w-36 rounded-r-lg border border-gray-300 bg-gray-50 px-2 py-2.5 text-sm text-gray-600 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors appearance-none cursor-pointer"
                  >
                    {EMAIL_DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors"
                placeholder="输入密码"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-xs text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-harbor-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-harbor-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-gray-400 hover:text-harbor-600 transition-colors"
              >
                忘记密码？
              </button>
            </div>
          </div>
        </form>

        {/* Forgot password modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">忘记密码</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                本应用为本地桌面应用，密码存储于本地数据库中。
                <br /><br />
                如需重置密码，请：
                <br />
                1. 联系管理员，请管理员登录后在后台重置你的密码。
                <br />
                2. 如果这是唯一的账号且无法登录，请重置数据库（会清除所有数据，需重新创建账号）。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={async () => {
                    if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
                      await window.harbor.invoke('db:reset')
                      window.location.reload()
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  重置数据库
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-center space-y-2">
          {onGoToRegister && (
            <div>
              <button
                onClick={onGoToRegister}
                className="text-xs text-harbor-600 hover:text-harbor-700 transition-colors"
              >
                注册账号
              </button>
            </div>
          )}
          <div>
            <button
              onClick={async () => {
                if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
                  await window.harbor.invoke('db:reset')
                  window.location.reload()
                }
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
            >
              重置数据库
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">Harbor v0.1.0</p>
      </div>
    </div>
  )
}
