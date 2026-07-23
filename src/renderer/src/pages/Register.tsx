import { useState, useRef, FormEvent } from 'react'

interface RegisterPageProps {
  onRegister: (user: { id: string; name: string; email: string; role: string }) => void
  onBackToLogin: () => void
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

export default function RegisterPage({ onRegister, onBackToLogin }: RegisterPageProps) {
  const [name, setName] = useState('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [emailDomain, setEmailDomain] = useState('@qq.com')
  const [customDomain, setCustomDomain] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  const fullEmail =
    emailDomain === '__custom__'
      ? emailPrefix + customDomain
      : emailPrefix + emailDomain

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Prevent double submission
    if (submittingRef.current) return
    submittingRef.current = true

    setError('')

    if (!name.trim()) { setError('请输入姓名'); submittingRef.current = false; return }
    if (!emailPrefix.trim()) { setError('请输入邮箱地址'); submittingRef.current = false; return }
    if (emailDomain === '__custom__' && !customDomain.trim()) {
      setError('请输入自定义邮箱域名'); submittingRef.current = false; return
    }
    if (!fullEmail.includes('@')) { setError('邮箱格式不正确'); submittingRef.current = false; return }
    if (password.length < 6) { setError('密码至少6位'); submittingRef.current = false; return }
    if (password !== confirmPassword) { setError('两次密码不一致'); submittingRef.current = false; return }

    setLoading(true)
    try {
      const result = await window.harbor.invoke<{
        success: boolean
        error?: string
        id?: string
        user?: { id: string; name: string; email: string; role: string }
      }>('auth:createUser', {
        name: name.trim(),
        email: fullEmail.trim(),
        password,
        role: 'broker'
      })

      if (result.success && result.user) {
        onRegister(result.user)
      } else {
        setError(result.error || '注册失败')
      }
    } catch {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
      submittingRef.current = false
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
          <h2 className="mb-6 text-sm font-semibold text-gray-700">注册账号</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors"
                placeholder="你的姓名"
                required
                autoFocus
              />
            </div>

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
                placeholder="至少 6 位"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-2 focus:ring-harbor-100 transition-colors"
                placeholder="再次输入密码"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-harbor-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-harbor-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={onBackToLogin}
            className="text-sm text-harbor-600 hover:text-harbor-700 transition-colors"
          >
            已有账号？登录
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">Harbor v0.1.0</p>
      </div>
    </div>
  )
}
