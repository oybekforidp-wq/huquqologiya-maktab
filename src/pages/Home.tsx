import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { myGroups } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDateTime } from '../lib/format'
import { TeacherInsights } from '../components/TeacherInsights'
import { Badge, Empty, Spinner, Stat } from '../components/ui'
import { KIND_LABEL, type Assignment, type Lesson, type Submission } from '../lib/types'

export default function Home() {
  const { profile } = useAuth()
  const groups = useQuery(() => myGroups(profile!), [profile?.id])
  const [sel, setSel] = useState<string | null>(null)
  const gid = sel ?? groups.data?.[0]?.id ?? null
  const isStudent = profile?.role === 'student'

  const data = useQuery(async () => {
    if (!gid) return null
    const now = new Date(Date.now() - 2 * 3600e3).toISOString()
    const [lessons, tasks, subs, att, grades] = await Promise.all([
      must<Lesson[]>(supabase.from('lessons').select('*').eq('group_id', gid).gte('starts_at', now).order('starts_at').limit(3)),
      must<Assignment[]>(supabase.from('assignments').select('id, group_id, lesson_id, title, kind, instructions, due_at, max_score').eq('group_id', gid).order('created_at', { ascending: false }).limit(6)),
      isStudent ? must<Submission[]>(supabase.from('submissions').select('*').eq('student_id', profile!.id)) : Promise.resolve([] as Submission[]),
      isStudent ? must<{ status: string; lessons: { group_id: string } }[]>(supabase.from('attendance').select('status, lessons!inner(group_id)').eq('student_id', profile!.id).eq('lessons.group_id', gid)) : Promise.resolve([]),
      isStudent ? must<{ value: number }[]>(supabase.from('grades').select('value').eq('group_id', gid).eq('student_id', profile!.id)) : Promise.resolve([]),
    ])
    return { lessons, tasks, subs, att, grades }
  }, [gid])

  const stats = useMemo(() => {
    if (!data.data) return null
    const { subs, att, grades, tasks } = data.data
    const mine = subs.filter((s) => tasks.some((t) => t.id === s.assignment_id) && s.score != null)
    const vals = [...grades.map((g) => g.value), ...mine.map((s) => Number(s.score))]
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
    const pres = att.filter((a) => a.status !== 'absent').length
    return { avg, att: att.length ? `${Math.round((pres / att.length) * 100)}%` : '—', done: subs.length }
  }, [data.data])

  if (groups.loading) return <Spinner />
  const first = profile!.full_name.split(' ')[0]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted">Xayrli kun,</div>
          <h1 className="m-0 font-display text-2xl font-bold md:text-3xl">{first}</h1>
        </div>
        {(groups.data?.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kurslarim">
            {groups.data!.map((g) => (
              <button key={g.id} role="tab" aria-selected={g.id === gid} onClick={() => setSel(g.id)}
                className={`h-10 cursor-pointer rounded-full px-4 text-sm ${g.id === gid ? 'border-0 bg-brand font-semibold text-white' : 'border border-field bg-white text-ink'}`}>
                {g.subjects?.name} · {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {profile!.role === 'teacher' && <TeacherInsights />}

      {!gid ? (
        <Empty title={isStudent ? "Siz hali guruhga qo'shilmagansiz" : "Sizga hali guruh biriktirilmagan"}
          text={profile!.role === 'admin' ? 'Avval fan va guruh yarating.' : "Admin guruhga qo'shgach, darslar shu yerda chiqadi."}
          action={profile!.role === 'admin' ? <Link className="btn-primary no-underline" to="/admin/fanlar">Fan va guruh yaratish</Link> : undefined} />
      ) : data.loading ? <Spinner /> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {data.data?.lessons[0] ? (
              <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-ink p-6 text-white">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-300">{data.data.lessons[0].is_live ? '● Hozir jonli' : `Keyingi dars · ${fmtDateTime(data.data.lessons[0].starts_at)}`}</div>
                  <div className="mt-2 text-xl font-semibold">{data.data.lessons[0].title}</div>
                </div>
                <Link to={`/dars/${data.data.lessons[0].id}`} className="btn h-12 bg-white px-6 text-ink no-underline">{isStudent ? "Darsga qo'shilish" : 'Darsni ochish'}</Link>
              </div>
            ) : (
              <div className="card p-6 text-muted">Yaqin kunlarda dars rejalashtirilmagan.</div>
            )}
            {isStudent && stats && (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="O'rtacha baho" value={stats.avg} />
                <Stat label="Davomat" value={stats.att} />
                <Stat label="Topshirilgan" value={stats.done} />
              </div>
            )}
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="m-0 text-lg font-bold">Vazifalar</h2>
                <Link to="/vazifalar" className="text-sm font-semibold">Hammasi</Link>
              </div>
              {!data.data?.tasks.length && <div className="p-5 text-muted">Hozircha vazifa yo'q.</div>}
              {data.data?.tasks.map((t) => {
                const sub = data.data!.subs.find((s) => s.assignment_id === t.id)
                return (
                  <Link key={t.id} to={`/vazifa/${t.id}`} className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5 text-ink no-underline last:border-0 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-sm text-muted">{KIND_LABEL[t.kind]}{t.due_at ? ` · ${fmtDateTime(t.due_at)} gacha` : ''}</div>
                    </div>
                    {isStudent && (sub ? (sub.score != null ? <Badge color="green">{sub.score} / {t.max_score}</Badge> : <Badge>Tekshirilmoqda</Badge>) : <Badge color="amber">Bajarilmagan</Badge>)}
                  </Link>
                )
              })}
            </section>
          </div>
          <aside className="flex min-w-0 flex-col gap-5">
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="m-0 text-lg font-bold">Yaqin darslar</h2>
              {!data.data?.lessons.length && <div className="text-sm text-muted">Reja yo'q</div>}
              {data.data?.lessons.map((l) => (
                <Link key={l.id} to={`/dars/${l.id}`} className="flex flex-col text-ink no-underline">
                  <span className="text-sm font-semibold">{l.title}</span>
                  <span className="text-xs text-muted">{fmtDateTime(l.starts_at)}</span>
                </Link>
              ))}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
