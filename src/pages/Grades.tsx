import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { myGroups } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDate } from '../lib/format'
import { Badge, Empty, PageHead, Spinner, Stat } from '../components/ui'
import { GroupTabs, useGroupSel } from '../components/GroupTabs'
import { KIND_LABEL, type Assignment, type Lesson, type Submission } from '../lib/types'

const ATT: Record<string, [string, 'green' | 'amber' | 'red']> = { present: ['Keldi', 'green'], late: ['Kech qoldi', 'amber'], absent: ['Kelmadi', 'red'] }

export default function Grades() {
  const { profile } = useAuth()
  const groups = useQuery(() => myGroups(profile!), [profile?.id])
  const { gid, pick, group } = useGroupSel(groups.data)
  const data = useQuery(async () => {
    if (!gid) return null
    const [tasks, subs, lessons, att] = await Promise.all([
      must<Assignment[]>(supabase.from('assignments').select('id, title, kind, max_score, due_at').eq('group_id', gid).order('created_at', { ascending: false })),
      must<Submission[]>(supabase.from('submissions').select('*').eq('student_id', profile!.id)),
      must<Lesson[]>(supabase.from('lessons').select('id, title, starts_at, ended_at').eq('group_id', gid).order('starts_at', { ascending: false })),
      must<{ lesson_id: string; status: string }[]>(supabase.from('attendance').select('lesson_id, status').eq('student_id', profile!.id)),
    ])
    return { tasks, subs, lessons: lessons.filter((l) => l.ended_at || new Date(l.starts_at) < new Date()), att }
  }, [gid])

  if (groups.loading) return <Spinner />
  if (!gid) return <><PageHead title="Baholarim" /><Empty title="Kurs topilmadi" /></>
  const d = data.data
  const graded = d ? d.tasks.map((t) => ({ t, s: d.subs.find((x) => x.assignment_id === t.id) })).filter((x) => x.s?.score != null) : []
  const avg = graded.length ? (graded.reduce((a, x) => a + (Number(x.s!.score) / x.t.max_score) * 5, 0) / graded.length).toFixed(1) : '—'
  const came = d ? d.att.filter((a) => a.status !== 'absent' && d.lessons.some((l) => l.id === a.lesson_id)).length : 0

  return (
    <>
      <PageHead title="Baholarim" sub={group ? `${group.subjects?.name} · ${group.name}` : ''} />
      <GroupTabs groups={groups.data!} gid={gid} pick={pick} />
      {data.loading || !d ? <Spinner /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="O'rtacha baho (5 lik)" value={avg} />
            <Stat label="Davomat" value={d.lessons.length ? `${Math.round((came / d.lessons.length) * 100)}%` : '—'} />
            <Stat label="Topshirilgan" value={`${d.subs.filter((s) => d.tasks.some((t) => t.id === s.assignment_id)).length} / ${d.tasks.length}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Vazifalar</h2>
              {!d.tasks.length && <div className="p-5 text-muted">Vazifa yo'q</div>}
              {d.tasks.map((t) => {
                const s = d.subs.find((x) => x.assignment_id === t.id)
                return (
                  <Link key={t.id} to={`/vazifa/${t.id}`} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 text-ink no-underline last:border-0 hover:bg-bg">
                    <div className="min-w-0 flex-1"><div className="font-semibold">{t.title}</div><div className="text-sm text-muted">{KIND_LABEL[t.kind]}</div></div>
                    {s ? (s.score != null ? <Badge color="green">{s.score} / {t.max_score}</Badge> : <Badge>Tekshirilmoqda</Badge>) : <Badge color="amber">Bajarilmagan</Badge>}
                  </Link>
                )
              })}
            </section>
            <section className="card overflow-hidden">
              <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Davomat</h2>
              {!d.lessons.length && <div className="p-5 text-muted">Hali dars bo'lmagan</div>}
              {d.lessons.map((l) => {
                const a = d.att.find((x) => x.lesson_id === l.id)
                const v = a ? ATT[a.status] : (['Kelmadi', 'red'] as const)
                return (
                  <div key={l.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1"><div className="font-semibold">{l.title}</div><div className="text-sm text-muted">{fmtDate(l.starts_at)}</div></div>
                    <Badge color={v[1]}>{v[0]}</Badge>
                  </div>
                )
              })}
            </section>
          </div>
        </div>
      )}
    </>
  )
}
