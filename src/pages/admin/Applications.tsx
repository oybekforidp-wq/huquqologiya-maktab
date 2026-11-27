import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getGroups, getProfiles, groupLabel } from '../../lib/data'
import { useQuery } from '../../lib/useQuery'
import { fmtDateTime } from '../../lib/format'
import { Badge, Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import { ROLE_LABEL, type Profile } from '../../lib/types'

export default function Applications() {
  const apps = useQuery(() => getProfiles({ status: 'pending' }))
  const groups = useQuery(getGroups)
  const students = useQuery(() => getProfiles({ role: 'student' }))
  const [pick, setPick] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function decide(p: Profile, ok: boolean) {
    setErr(null)
    const gid = pick[p.id] ?? groups.data?.[0]?.id
    const child = p.role === 'parent' ? students.data?.find((x) => x.login === (p.child_login ?? '').toLowerCase()) : undefined
    if (ok && p.role === 'student' && !gid) return setErr("Avval \"Fanlar va guruhlar\" bo'limida guruh yarating")
    setBusy(p.id)
    try {
      const { error } = await supabase.from('profiles').update({ status: ok ? 'active' : 'rejected' }).eq('id', p.id)
      if (error) throw error
      if (ok && p.role === 'student') {
        const { error: e2 } = await supabase.from('enrollments').upsert({ group_id: gid, student_id: p.id })
        if (e2) throw e2
      }
      if (ok && p.role === 'parent') {
        if (child) {
          const { error: e3 } = await supabase.from('parent_links').upsert({ parent_id: p.id, student_id: child.id })
          if (e3) throw e3
        } else setErr(`Farzand "${p.child_login ?? ''}" logini topilmadi. Foydalanuvchilar sahifasida qo'lda bog'lang.`)
      }
      await apps.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <PageHead title="Yangi arizalar" sub="Tasdiqlaganingizdan keyin o'quvchiga faqat tanlangan guruh va fan ochiladi." />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}
      {apps.loading || groups.loading || students.loading ? <Spinner /> : !apps.data?.length ? (
        <Empty title="Yangi ariza yo'q" text="O'quvchi ro'yxatdan o'tganda shu yerda paydo bo'ladi." />
      ) : (
        <div className="flex flex-col gap-3">
          {apps.data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="min-w-48 flex-1">
                <div className="flex items-center gap-2 font-semibold">{p.full_name}<Badge color={p.role === 'student' ? 'blue' : p.role === 'teacher' ? 'amber' : 'green'}>Rol: {ROLE_LABEL[p.role]}</Badge></div>
                <div className="text-sm text-muted">{p.phone} · login: {p.login} · {fmtDateTime(p.created_at)}</div>
                {p.role === 'parent' && (
                  <div className="text-sm">Farzandi logini: <b>{p.child_login || '—'}</b>{' '}
                    {students.data?.some((x) => x.login === (p.child_login ?? '').toLowerCase()) ? <Badge color="green">topildi</Badge> : <Badge color="red">topilmadi</Badge>}
                  </div>
                )}
              </div>
              {p.role === 'student' && <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Guruh:</span>
                <select className="input h-10 w-64" value={pick[p.id] ?? groups.data?.[0]?.id ?? ''}
                  onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                  {groups.data?.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                </select>
              </label>}
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
