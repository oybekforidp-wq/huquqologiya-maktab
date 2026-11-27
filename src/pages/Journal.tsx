import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { myGroups } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDate } from '../lib/format'
import { Empty, PageHead, Spinner } from '../components/ui'
import { GroupTabs, useGroupSel } from '../components/GroupTabs'
import type { Assignment, Lesson, Profile, Submission } from '../lib/types'

const ATT: Record<string, [string, string]> = { present: ['+', 'text-green-700'], late: ['K', 'text-amber-600'], absent: ['−', 'text-red-600'] }

// O'qituvchi jurnali: davomat va vazifa ballari bitta jadvalda
export default function Journal() {
  const { profile } = useAuth()
  const groups = useQuery(() => myGroups(profile!), [profile?.id])
  const { gid, pick, group } = useGroupSel(groups.data)
  const data = useQuery(async () => {
    if (!gid) return null
    const [stu, lessons, tasks] = await Promise.all([
      must<{ profiles: Profile }[]>(supabase.from('enrollments').select('profiles(*)').eq('group_id', gid)),
      must<Lesson[]>(supabase.from('lessons').select('id, title, starts_at').eq('group_id', gid).order('starts_at')),
      must<Assignment[]>(supabase.from('assignments').select('id, title, kind, max_score, created_at').eq('group_id', gid).order('created_at')),
    ])
    const lids = lessons.map((l) => l.id), tids = tasks.map((t) => t.id)
    const [att, subs] = await Promise.all([
      lids.length ? must<{ lesson_id: string; student_id: string; status: string }[]>(supabase.from('attendance').select('lesson_id, student_id, status').in('lesson_id', lids)) : [],
      tids.length ? must<Submission[]>(supabase.from('submissions').select('assignment_id, student_id, score').in('assignment_id', tids)) : [],
    ])
    return { stu: stu.map((s) => s.profiles).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name)), lessons, tasks, att, subs }
  }, [gid])

  if (groups.loading) return <Spinner />
  if (!gid) return <><PageHead title="Jurnal" /><Empty title="Guruh topilmadi" /></>
  const d = data.data
  return (
    <>
      <PageHead title="Jurnal" sub={group ? `${group.subjects?.name} · ${group.name} · + keldi, K kech, − kelmadi` : ''} />
      <GroupTabs groups={groups.data!} gid={gid} pick={pick} />
      {data.loading || !d ? <Spinner /> : !d.stu.length ? <Empty title="Guruhda o'quvchi yo'q" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-bg text-left">
                <th className="sticky left-0 z-10 min-w-48 bg-bg px-4 py-3">O'quvchi</th>
                {d.lessons.map((l) => <th key={l.id} title={l.title} className="px-2 py-3 text-center font-semibold whitespace-nowrap">{fmtDate(l.starts_at)}</th>)}
                {d.tasks.map((t) => <th key={t.id} title={t.title} className="max-w-28 truncate px-2 py-3 text-center font-semibold text-brand">{t.title.slice(0, 14)}</th>)}
                <th className="px-3 py-3 text-center">Davomat</th>
                <th className="px-3 py-3 text-center">O'rtacha</th>
              </tr>
            </thead>
            <tbody>
              {d.stu.map((s) => {
                const myAtt = d.att.filter((a) => a.student_id === s.id)
                const pct = d.lessons.length ? Math.round((myAtt.filter((a) => a.status !== 'absent').length / d.lessons.length) * 100) : null
                const scores = d.tasks.map((t) => { const x = d.subs.find((y) => y.assignment_id === t.id && y.student_id === s.id); return x?.score != null ? (Number(x.score) / t.max_score) * 5 : null })
                const got = scores.filter((x): x is number => x != null)
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="sticky left-0 bg-white px-4 py-2.5 font-semibold">{s.full_name}</td>
                    {d.lessons.map((l) => { const a = myAtt.find((x) => x.lesson_id === l.id); const v = a ? ATT[a.status] : null; return <td key={l.id} className={`px-2 py-2.5 text-center font-bold ${v?.[1] ?? 'text-slate-300'}`}>{v?.[0] ?? '·'}</td> })}
                    {d.tasks.map((t) => { const x = d.subs.find((y) => y.assignment_id === t.id && y.student_id === s.id); return <td key={t.id} className="px-2 py-2.5 text-center">{x ? (x.score != null ? x.score : '…') : <span className="text-slate-300">—</span>}</td> })}
                    <td className="px-3 py-2.5 text-center">{pct != null ? `${pct}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-center font-bold">{got.length ? (got.reduce((a, b) => a + b, 0) / got.length).toFixed(1) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
