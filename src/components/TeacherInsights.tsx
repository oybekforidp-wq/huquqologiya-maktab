import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useQuery, must } from '../lib/useQuery'
import { fmtDate } from '../lib/format'
import { Stars } from './Stars'
import type { RatingSummary } from '../lib/types'

type Com = { id: string; parent_id: string; student_id: string; body: string; created_at: string }

// Ustozning bosh sahifasi: o'rtacha reyting va ota-onalar fikrlari
export function TeacherInsights() {
  const { profile } = useAuth()
  const sum = useQuery(() => must<RatingSummary>(supabase.rpc('teacher_rating_summary')), [profile?.id])
  const coms = useQuery(async () => {
    const c = await must<Com[]>(supabase.from('parent_comments').select('*').order('created_at', { ascending: false }).limit(10))
    const ids = [...new Set(c.flatMap((x) => [x.parent_id, x.student_id]))]
    const p = ids.length ? await must<{ id: string; full_name: string }[]>(supabase.from('profiles').select('id, full_name').in('id', ids)) : []
    return c.map((x) => ({ ...x, parent: p.find((y) => y.id === x.parent_id)?.full_name ?? '', student: p.find((y) => y.id === x.student_id)?.full_name ?? '' }))
  }, [profile?.id])

  const s = sum.data
  const total = s ? s.lesson_count + s.parent_count : 0
  const avg = s && total ? ((Number(s.lesson_avg ?? 0) * s.lesson_count + Number(s.parent_avg ?? 0) * s.parent_count) / total) : null

  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-2">
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="m-0 text-lg font-bold">Mening reytingim</h2>
        {avg == null ? <div className="text-muted">Hali baho qo'yilmagan.</div> : (
          <>
            <div className="flex items-center gap-3"><span className="font-display text-3xl font-bold">{avg.toFixed(1)}</span><Stars value={avg} size={22} /></div>
            <div className="text-sm text-muted">O'quvchilar: {s!.lesson_avg ?? '—'} ({s!.lesson_count}) · Ota-onalar: {s!.parent_avg ?? '—'} ({s!.parent_count})</div>
            {s!.comments.slice(0, 3).map((c, i) => <div key={i} className="rounded-lg bg-bg px-3 py-2 text-sm">{'★'.repeat(c.stars)} {c.comment}</div>)}
          </>
        )}
      </section>
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="m-0 text-lg font-bold">Ota-onalar fikrlari</h2>
        {!coms.data?.length && <div className="text-muted">Hozircha fikr yo'q.</div>}
        {coms.data?.map((c) => (
          <div key={c.id} className="rounded-lg bg-bg px-3 py-2 text-sm">
            <div className="text-xs text-muted">{c.parent} · o'quvchi: {c.student} · {fmtDate(c.created_at)}</div>{c.body}
          </div>
        ))}
      </section>
    </div>
  )
}
