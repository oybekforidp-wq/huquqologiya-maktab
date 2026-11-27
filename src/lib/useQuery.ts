import { useCallback, useEffect, useState } from 'react'

// Oddiy ma'lumot yuklash hook'i
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await fn()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { run() }, [run])
  return { data, error, loading, reload: run }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function must<T>(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
