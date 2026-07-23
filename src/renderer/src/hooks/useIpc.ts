import { useState, useCallback, useEffect } from 'react'

export function useIpcInvoke<T = unknown>(channel: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invoke = useCallback(
    async (...args: unknown[]) => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.harbor.invoke<T>(channel, ...args)
        setData(result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [channel]
  )

  return { data, loading, error, invoke }
}

export function useIpcEvent(channel: string, handler: (...args: unknown[]) => void) {
  useEffect(() => {
    window.harbor.on(channel, handler)
    return () => {
      window.harbor.off(channel, handler)
    }
  }, [channel, handler])
}
