import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getProfiles } from '../../lib/data'
import { useQuery } from '../../lib/useQuery'
import { Badge, ErrorBox, PageHead, Spinner } from '../../components/ui'
import type { Role, Status } from '../../lib/types'

const statusColor = { active: 'green', pending: 'amber', rejected: 'red' } as const
const statusText = { active: 'Faol', pending: 'Kutmoqda', rejected: 'Rad etilgan' }

export default function Users() {
  const users = useQuery(() => getProfiles())
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function patch(id: string, v: { role?: Role; status?: Status }) {
    setErr(null)
    const { error } = await supabase.from('profiles').update(v).eq('id', id)
    if (error) setErr(error.message)
    users.reload()
  }

  const list = (users.data ?? []).filter((u) => `${u.full_name} ${u.login} ${u.phone}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead title="Foydalanuvchilar" sub="Rolni o'zgartirish: o'quvchi, o'qituvchi yoki admin." />
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
                        <option value="student">O'quvchi</option><option value="teacher">O'qituvchi</option><option value="admin">Admin</option>
                      </select>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
