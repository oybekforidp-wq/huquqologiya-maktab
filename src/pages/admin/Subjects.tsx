import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { getGroups, getProfiles, getSubjects } from '../../lib/data'
import { useQuery, must } from '../../lib/useQuery'
import { Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import { Icon } from '../../components/Icon'
import type { Profile } from '../../lib/types'

export default function Subjects() {
  const subjects = useQuery(getSubjects)
  const groups = useQuery(getGroups)
  const staff = useQuery(async () => (await getProfiles({ status: 'active' })).filter((p) => p.role !== 'student'))
  const students = useQuery(() => getProfiles({ status: 'active', role: 'student' }))
  const members = useQuery(() => must<{ group_id: string; student_id: string }[]>(supabase.from('enrollments').select('group_id, student_id')))
  const [err, setErr] = useState<string | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const [newGroup, setNewGroup] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ...reload: { reload: () => Promise<void> }[]) => {
    setErr(null)
    const { error } = await fn()
    if (error) setErr(error.message)
    await Promise.all(reload.map((r) => r.reload()))
  }

  const addSubject = (e: FormEvent) => {
    e.preventDefault()
    if (!newSubject.trim()) return
    run(() => supabase.from('subjects').insert({ name: newSubject.trim() }), subjects).then(() => setNewSubject(''))
  }

  if (subjects.loading || groups.loading) return <Spinner />
  const byId = new Map((students.data ?? []).map((s) => [s.id, s]))

  return (
    <>
      <PageHead title="Fanlar va guruhlar" sub="Har fanning o'z guruhlari va o'qituvchisi bor. O'quvchi faqat a'zo bo'lgan guruhini ko'radi." />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}

      <form onSubmit={addSubject} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="label min-w-60 flex-1">Yangi fan nomi<input className="input" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="masalan, Ingliz tili" /></label>
        <button className="btn-primary h-12"><Icon name="plus" />Fan qo'shish</button>
      </form>

      {!subjects.data?.length && <Empty title="Hali fan yo'q" />}
      <div className="flex flex-col gap-5">
        {subjects.data?.map((s) => {
          const gs = groups.data?.filter((g) => g.subject_id === s.id) ?? []
          return (
            <section key={s.id} className="card p-5">
              <h2 className="m-0 mb-4 text-xl font-bold">{s.name}</h2>
              <div className="flex flex-col gap-3">
                {gs.map((g) => {
                  const mem = (members.data ?? []).filter((m) => m.group_id === g.id)
                  const isOpen = open === g.id
                  return (
                    <div key={g.id} className="rounded-xl border border-line">
                      <div className="flex flex-wrap items-center gap-3 p-3">
                        <div className="min-w-32 flex-1 font-semibold">{g.name} <span className="font-normal text-muted">· {mem.length} o'quvchi</span></div>
                        <label className="flex items-center gap-2 text-sm"><span className="text-muted">O'qituvchi:</span>
                          <select className="input h-10 w-56" value={g.teacher_id ?? ''}
                            onChange={(e) => run(() => supabase.from('groups').update({ teacher_id: e.target.value || null }).eq('id', g.id), groups)}>
                            <option value="">— tanlanmagan —</option>
                            {staff.data?.map((t: Profile) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                          </select>
                        </label>
                        <button className="btn-ghost h-10" onClick={() => setOpen(isOpen ? null : g.id)}>{isOpen ? 'Yopish' : "O'quvchilar"}</button>
                      </div>
                      {isOpen && (
                        <div className="flex flex-col gap-2 border-t border-line p-3">
                          {mem.map((m) => (
                            <div key={m.student_id} className="flex items-center gap-2 text-sm">
                              <span className="flex-1">{byId.get(m.student_id)?.full_name ?? '—'}</span>
                              <button className="btn-ghost h-9 text-sm" onClick={() => run(() => supabase.from('enrollments').delete().eq('group_id', g.id).eq('student_id', m.student_id), members)}>Chiqarish</button>
                            </div>
                          ))}
                          <select className="input h-10" value="" onChange={(e) => e.target.value && run(() => supabase.from('enrollments').insert({ group_id: g.id, student_id: e.target.value }), members)}>
                            <option value="">+ O'quvchi qo'shish…</option>
                            {students.data?.filter((st) => !mem.some((m) => m.student_id === st.id)).map((st) => <option key={st.id} value={st.id}>{st.full_name} ({st.login})</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault()
                  const name = (newGroup[s.id] ?? '').trim()
                  if (name) run(() => supabase.from('groups').insert({ subject_id: s.id, name }), groups).then(() => setNewGroup({ ...newGroup, [s.id]: '' }))
                }}>
                  <label className="flex-1"><span className="sr-only">Yangi guruh nomi</span>
                    <input className="input h-10" placeholder="Yangi guruh nomi, masalan 9-B yoki Sertifikat-1" value={newGroup[s.id] ?? ''} onChange={(e) => setNewGroup({ ...newGroup, [s.id]: e.target.value })} />
                  </label>
                  <button className="btn-ghost h-10"><Icon name="plus" />Guruh</button>
                </form>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
