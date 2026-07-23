import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

interface Mailbox {
  id: string; name: string; provider: string; host: string; port: number
  username: string; folders: string[] | null; sync_frequency: number
  last_synced_at: string | null; sync_status: string; error_message: string | null
  total_synced: number; created_at: string
}

const PROVIDER_PRESETS: Record<string, { host: string; port: number; label: string }> = {
  GMAIL: { host: 'imap.gmail.com', port: 993, label: 'Gmail' },
  OUTLOOK: { host: 'outlook.office365.com', port: 993, label: 'Outlook / Office 365' },
  QQ: { host: 'imap.qq.com', port: 993, label: 'QQ 邮箱' },
  '163': { host: 'imap.163.com', port: 993, label: '163 邮箱' },
  CUSTOM: { host: '', port: 993, label: '自定义 IMAP' },
}

/* ── Main ─────────────────────────────────────── */

export default function MailboxSettings() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const items = await window.harbor.invoke<Mailbox[]>('mailboxes:list')
    setMailboxes(items)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSync = async (id: string, name: string) => {
    setSyncMsg(`正在同步 ${name}...`)
    try {
      const r = await window.harbor.invoke<{ success: boolean; total: number; new: number; error?: string }>('mailboxes:sync', id)
      if (r.success) setSyncMsg(`同步完成: 共 ${r.total} 封, 新增 ${r.new} 封`)
      else setSyncMsg(`同步失败: ${r.error}`)
      load()
    } catch (e: any) { setSyncMsg(`同步失败: ${e.message}`) }
    setTimeout(() => setSyncMsg(''), 5000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要移除此邮箱吗？')) return
    await window.harbor.invoke('mailboxes:delete', id)
    load()
  }

  return (
    <div className="max-w-[800px]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">邮箱设置</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">管理连接的邮箱账户，同步邮件到收件箱</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-gray-800 transition-colors">
          + 添加邮箱
        </button>
      </div>

      {syncMsg && (
        <div className="mb-4 rounded-xl bg-harbor-50 border border-harbor-100 px-4 py-3 text-[13px] text-harbor-700">{syncMsg}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({length:2}).map((_,i)=><div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-6"><div className="h-4 w-48 rounded bg-gray-100"/></div>)}
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h3 className="text-[15px] font-semibold text-gray-700 mb-1">暂无连接的邮箱</h3>
          <p className="text-[13px] text-gray-400 mb-4">
            连接邮箱账户以自动将邮件同步到收件箱。<br />
            系统不会在后台自动读取任何私人通讯，仅同步你指定的文件夹。
          </p>
          <button onClick={() => setShowAdd(true)}
            className="rounded-xl bg-harbor-600 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-harbor-700 transition-colors">
            连接第一个邮箱
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {mailboxes.map(m => (
            <div key={m.id} className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{PROVIDER_PRESETS[m.provider]?.label?.[0] || '📧'}</span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-gray-900">{m.name}</h3>
                      <p className="text-[12px] text-gray-400">{m.username} · {m.host}:{m.port}</p>
                    </div>
                  </div>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  m.sync_status === 'CONNECTED' ? 'bg-green-50 text-green-600' :
                  m.sync_status === 'SYNCING' ? 'bg-blue-50 text-blue-600' :
                  m.sync_status === 'ERROR' ? 'bg-red-50 text-red-600' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {m.sync_status === 'CONNECTED' ? '已连接' :
                   m.sync_status === 'SYNCING' ? '同步中' :
                   m.sync_status === 'ERROR' ? '错误' : '未连接'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-400">
                {m.last_synced_at && <span>上次同步: {new Date(m.last_synced_at).toLocaleString('zh-CN')}</span>}
                {m.total_synced > 0 && <span>已同步 {m.total_synced} 封</span>}
                {m.error_message && <span className="text-red-500">{m.error_message}</span>}
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => handleSync(m.id, m.name)}
                  className="rounded-lg bg-harbor-600 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-harbor-700 transition-colors">
                  🔄 立即同步
                </button>
                <button onClick={() => handleDelete(m.id)}
                  className="rounded-lg border border-gray-200 px-3.5 py-2 text-[12px] text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddMailboxModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

/* ── Add Mailbox Modal ────────────────────────── */

function AddMailboxModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('QQ')
  const [host, setHost] = useState(PROVIDER_PRESETS.QQ.host)
  const [port, setPort] = useState(PROVIDER_PRESETS.QQ.port)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [error, setError] = useState('')

  const handleProviderChange = (p: string) => {
    setProvider(p)
    if (p !== 'CUSTOM') {
      setHost(PROVIDER_PRESETS[p].host)
      setPort(PROVIDER_PRESETS[p].port)
    }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult('')
    try {
      const r = await window.harbor.invoke<{ success: boolean; error?: string }>('mailboxes:test', {
        host, port, tls: true, username, password
      })
      setTestResult(r.success ? '✓ 连接成功' : `✗ ${r.error || '连接失败'}`)
    } catch { setTestResult('✗ 测试失败') }
    finally { setTesting(false) }
  }

  const handleSave = async () => {
    if (!name.trim() || !host.trim() || !username.trim() || !password.trim()) {
      setError('请填写所有必填字段'); return
    }
    setSaving(true); setError('')
    try {
      await window.harbor.invoke('mailboxes:add', {
        name: name.trim(),
        provider,
        host: host.trim(),
        port,
        tls: true,
        username: username.trim(),
        password,
        folders: ['INBOX'],
        syncFrequency: 15,
      })
      onAdded()
    } catch (e: any) { setError(e.message || '添加失败') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">添加邮箱</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">邮箱名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="例如: 公司邮箱、张三-QQ" autoFocus
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">服务商</label>
            <select value={provider} onChange={e => handleProviderChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500 bg-white">
              {Object.entries(PROVIDER_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">服务器</label>
              <input type="text" value={host} onChange={e => setHost(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
            </div>
            <div className="w-20">
              <label className="text-[11px] font-medium text-gray-400 mb-1 block">端口</label>
              <input type="number" value={port} onChange={e => setPort(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">用户名</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">密码/授权码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="IMAP 密码或应用授权码"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-harbor-500" />
            <p className="text-[11px] text-gray-400 mt-1">
              QQ邮箱/163邮箱请使用授权码而非登录密码。
              <br />密码仅存储在本地，使用系统级加密保护。
            </p>
          </div>

          {testResult && (
            <div className={cn('rounded-xl px-4 py-2.5 text-[13px]', testResult.startsWith('✓') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
              {testResult}
            </div>
          )}
          {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleTest} disabled={testing}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-[13px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl bg-gray-900 py-3 text-[13px] font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存并连接'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
