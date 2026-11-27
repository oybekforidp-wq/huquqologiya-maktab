import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getGroups, getProfiles, groupLabel } from '../../lib/data'
import { useQuery } from '../../lib/useQuery'
import { fmtDateTime } from '../../lib/format'
import { Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import type { Profile } from '../../lib/types'

export default function Applications() {
  const apps = useQuery(() => getProfiles({ status: 'pending' }))
  const groups = useQuery(getGroups)
  const [pick, setPick] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function decide(p: Profile, ok: boolean) {
    setErr(null)
    const gid = pick[p.id] ?? groups.data?.[0]?.id
    if (ok && !gid) return setErr("Avval \"Fanlar va guruhlar\" bo'limida guruh yarating")
    setBusy(p.id)
    try {
      const { error } = await supabase.from('profiles').update({ status: ok ? 'active' : 'rejected' }).eq('id', p.id)
      if (error) throw error
      if (ok) {
        const { error: e2 } = await supabase.from('enrollments').upsert({ group_id: gid, student_id: p.id })
        if (e2) throw e2
      }
      await apps.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <PageHead title="Yangi arizalar" sub="Tasdiqlaganingizdan keyin o'quvchiga faqat tanlangan guruh va fan ochiladi." />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}
      {apps.loading || groups.loading ? <Spinner /> : !apps.data?.length ? (
        <Empty title="Yangi ariza yo'q" text="O'quvchi ro'yxatdan o'tganda shu yerda paydo bo'ladi." />
      ) : (
        <div className="flex flex-col gap-3">
          {apps.data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="min-w-48 flex-1">
                <div className="font-semibold">{p.full_name}</div>
                <div className="text-sm text-muted">{p.phone} · login: {p.login} · {fmtDateTime(p.created_at)}</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Guruh:</span>
                <select className="input h-10 w-64" value={pick[p.id] ?? groups.data?.[0]?.id ?? ''}
                  onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                  {groups.data?.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button className="btn-ghost h-10" disabled={busy === p.id} onClick={() => decide(p, false)}>Rad etish</button>
                <button className="btn-primary h-10" disabled={busy === p.id} onClick={() => decide(p, true)}>Tasdiqlash</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
