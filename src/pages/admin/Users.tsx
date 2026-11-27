import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getProfiles } from '../../lib/data'
import { useQuery } from '../../lib/useQuery'
import { Badge, ErrorBox, PageHead, Spinner } from '../../components/ui'
import type { Role, Status } from '../../lib/types'

type Link = { parent_id: string; student_id: string }

const statusColor = { active: 'green', pending: 'amber', rejected: 'red' } as const
const statusText = { active: 'Faol', pending: 'Kutmoqda', rejected: 'Rad etilgan' }

export default function Users() {
  const users = useQuery(() => getProfiles())
  const links = useQuery(async () => (await supabase.from('parent_links').select('parent_id, student_id')).data as Link[] ?? [])
  const [np, setNp] = useState('')
  const [ns, setNs] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function patch(id: string, v: { role?: Role; status?: Status }) {
    setErr(null)
    const { error } = await supabase.from('profiles').update(v).eq('id', id)
    if (error) setErr(error.message)
    users.reload()
  }

  async function addLink() {
    if (!np || !ns) return
    setErr(null)
    const { error } = await supabase.from('parent_links').upsert({ parent_id: np, student_id: ns })
    if (error) setErr(error.message)
    links.reload()
  }
  async function delLink(l: Link) {
    setErr(null)
    const { error } = await supabase.from('parent_links').delete().eq('parent_id', l.parent_id).eq('student_id', l.student_id)
    if (error) setErr(error.message)
    links.reload()
  }
  const all = users.data ?? []
  const name = (id: string) => all.find((u) => u.id === id)?.full_name ?? id

  const list = (users.data ?? []).filter((u) => `${u.full_name} ${u.login} ${u.phone}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead title="Foydalanuvchilar" sub="Rolni o'zgartirish: o'quvchi, o'qituvchi, ota-ona yoki admin." />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}
      <label className="mb-4 block"><span className="sr-only">Qidirish</span>
        <input className="input" placeholder="Ism, login yoki telefon bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {users.loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-muted">
              <th className="p-3">ISM</th><th className="p-3">LOGIN</th><th className="p-3">TELEFON</th><th className="p-3">HOLAT</th><th className="p-3">ROL</th>
            </tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="p-3 font-medium">{u.full_name}</td>
                  <td className="p-3 text-muted">{u.login}</td>
                  <td className="p-3">{u.phone}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2"><Badge color={statusColor[u.status]}>{statusText[u.status]}</Badge>
                      {u.status !== 'active' && <button className="btn-ghost h-8 px-2 text-xs" onClick={() => patch(u.id, { status: 'active' })}>Faollashtirish</button>}
                      {u.status === 'active' && <button className="btn-ghost h-8 px-2 text-xs" onClick={() => patch(u.id, { status: 'rejected' })}>Bloklash</button>}
                    </div>
                  </td>
                  <td className="p-3">
                    <label><span className="sr-only">Rol</span>
                      <select className="input h-9 w-40" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value as Role })}>
                        <option value="student">O'quvchi</option><option value="teacher">O'qituvchi</option><option value="parent">Ota-ona</option><option value="admin">Admin</option>
                      </select>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="card mt-6 flex flex-col gap-3 p-5">
        <h2 className="m-0 text-lg font-bold">Ota-ona va farzand bog'lanishi</h2>
        <div className="flex flex-wrap gap-2">
          <select className="input h-10 w-60" aria-label="Ota-ona" value={np} onChange={(e) => setNp(e.target.value)}>
            <option value="">Ota-ona…</option>{all.filter((u) => u.role === 'parent').map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select className="input h-10 w-60" aria-label="Farzand" value={ns} onChange={(e) => setNs(e.target.value)}>
            <option value="">Farzand (o'quvchi)…</option>{all.filter((u) => u.role === 'student').map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.login})</option>)}
          </select>
          <button className="btn-primary h-10" onClick={addLink}>Bog'lash</button>
        </div>
        {!links.data?.length && <div className="text-sm text-muted">Bog'lanish yo'q</div>}
        {links.data?.map((l) => (
          <div key={l.parent_id + l.student_id} className="flex items-center gap-3 border-t border-line pt-2 text-sm">
            <span className="flex-1">{name(l.parent_id)} → {name(l.student_id)}</span>
            <button className="btn-ghost h-8 px-2 text-xs" onClick={() => delLink(l)}>Olib tashlash</button>
          </div>
        ))}
      </section>
    </>
  )
}
