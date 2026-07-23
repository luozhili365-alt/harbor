import { useState, useRef, useEffect } from 'react'

interface ProfileDropdownProps {
  user: { id: string; name: string; email: string; role: string }
  onLogout: () => void
}

export default function ProfileDropdown({ user, onLogout }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess(false)

    if (newPassword.length < 6) { setPwError('新密码至少6位'); return }
    if (newPassword !== confirmNewPassword) { setPwError('两次密码不一致'); return }

    setPwLoading(true)
    try {
      const result = await window.harbor.invoke<{ success: boolean; error?: string }>(
        'auth:changePassword',
        user.id,
        currentPassword,
        newPassword
      )
      if (result.success) {
        setPwSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setTimeout(() => {
          setShowChangePassword(false)
          setPwSuccess(false)
        }, 1500)
      } else {
        setPwError(result.error || '修改失败')
      }
    } catch {
      setPwError('修改失败，请重试')
    } finally {
      setPwLoading(false)
    }
  }

  const roleLabel = (role: string) => {
    if (role === 'admin') return '管理员'
    if (role === 'broker') return '报关员'
    return role
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar trigger */}
      <button
        onClick={() => {
          setOpen(!open)
          setShowChangePassword(false)
          setPwError('')
          setPwSuccess(false)
        }}
        className="h-8 w-8 rounded-full bg-harbor-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-harbor-700 transition-colors shadow-sm"
        title={user.name}
      >
        {user.name.charAt(0)}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          {/* User info header */}
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-harbor-100 flex items-center justify-center text-sm font-semibold text-harbor-700">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <span className="inline-block mt-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {roleLabel(user.role)}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {!showChangePassword ? (
              <>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-base">🔑</span>
                  修改密码
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <span className="text-base">🚪</span>
                  退出登录
                </button>
              </>
            ) : (
              /* Change password form */
              <div className="px-4 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">修改密码</span>
                  <button
                    onClick={() => {
                      setShowChangePassword(false)
                      setPwError('')
                      setPwSuccess(false)
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    返回
                  </button>
                </div>

                {pwSuccess ? (
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-600 mb-2">
                    ✓ 密码修改成功
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="当前密码"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-1 focus:ring-harbor-100"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新密码（至少 6 位）"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-1 focus:ring-harbor-100"
                    />
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="确认新密码"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-harbor-500 focus:outline-none focus:ring-1 focus:ring-harbor-100"
                    />

                    {pwError && (
                      <div className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
                        {pwError}
                      </div>
                    )}

                    <button
                      onClick={handleChangePassword}
                      disabled={pwLoading}
                      className="w-full rounded-lg bg-harbor-600 px-3 py-2 text-xs font-medium text-white hover:bg-harbor-700 disabled:opacity-50 transition-colors"
                    >
                      {pwLoading ? '修改中...' : '确认修改'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
