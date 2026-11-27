import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useQuery, must } from '../../lib/useQuery'
import { errText, fmtDateTime as fmtDateTimeSafe } from '../../lib/format'
import { Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import { Stars } from '../../components/Stars'
import type { ChildReport } from '../../lib/types'

type Kid = { id: string; full_name: string }
type Teacher = { id: string; name: string }
type Rating = { teacher_id: string; stars: number; comment: string | null }
type Comment = { id: string; student_id: string; body: string; created_at: string }

export default function ParentFeedback() {
  const { profile } = useAuth()
  const data = useQuery(async () => {
    const kids = await must<Kid[]>(supabase.rpc('my_children'))
    const reps = await Promise.all(kids.map((k) => must<ChildReport>(supabase.rpc('child_report', { p_student: k.id }))))
    const teachers = new Map<string, Teacher>()
    reps.forEach((r) => r.groups.forEach((g) => { if (g.teacher_id) teachers.set(g.teacher_id, { id: g.teacher_id, name: g.teacher_name ?? '—' }) }))
    const ratings = await must<Rating[]>(supabase.from('teacher_ratings').select('teacher_id, stars, comment').eq('rater_id', profile!.id))
    const comments = await must<Comment[]>(supabase.from('parent_comments').select('id, student_id, body, created_at').eq('parent_id', profile!.id).order('created_at', { ascending: false }))
    return { kids, teachers: [...teachers.values()], ratings, comments }
  }, [profile?.id])

  const [kid, setKid] = useState('')
  const [body, setBody] = useState('')
  const [rate, setRate] = useState<Record<string, { stars: number; comment: string }>>({})
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const d = data.data
  const kidId = kid || d?.kids[0]?.id || ''

  async function sendComment() {
    if (!body.trim() || !kidId) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('parent_comments').insert({ parent_id: profile!.id, student_id: kidId, body: body.trim() })
    setBusy(false)
    if (error) return setErr(errText(error))
    setBody(''); data.reload()
  }
  async function sendRating(t: Teacher) {
    const cur = rate[t.id] ?? { stars: d?.ratings.find((r) => r.teacher_id === t.id)?.stars ?? 0, comment: '' }
    if (!cur.stars) return setErr('Yulduzlar sonini tanlang')
    setBusy(true); setErr(null)
    const { error } = await supabase.from('teacher_ratings').upsert(
      { teacher_id: t.id, rater_id: profile!.id, rater_role: 'parent', stars: cur.stars, comment: cur.comment.trim() || null },
      { onConflict: 'teacher_id,rater_id' })
    setBusy(false)
    if (error) return setErr(errText(error))
    data.reload()
  }

  return (
    <>
      <PageHead title="Fikr va baho" sub="Ustozga fikr qoldiring va uning ishini baholang." />
      {(err || data.error) && <div className="mb-4"><ErrorBox text={(err ?? data.error)!} /></div>}
      {data.loading || !d ? <Spinner /> : !d.kids.length ? (
        <Empty title="Farzand biriktirilmagan" text="Admin farzandingizni bog'lagach, bu bo'lim ochiladi." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="m-0 text-lg font-bold">Fikr qoldirish</h2>
            <p className="m-0 text-sm text-muted">Fikringizni farzandingiz ustozlari va admin ko'radi.</p>
            {d.kids.length > 1 && (
              <label className="label">Farzand
                <select className="input" value={kidId} onChange={(e) => setKid(e.target.value)}>{d.kids.map((k) => <option key={k.id} value={k.id}>{k.full_name}</option>)}</select>
              </label>
            )}
            <textarea className="input min-h-28 py-2" aria-label="Fikr" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Fikringiz..." />
            <button className="btn-primary h-11" disabled={busy || !body.trim()} onClick={sendComment}>Yuborish</button>
            {d.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-bg px-3 py-2 text-sm">
                <div className="text-xs text-muted">{d.kids.find((k) => k.id === c.student_id)?.full_name} · {fmtDateTimeSafe(c.created_at)}</div>
                {c.body}
              </div>
            ))}
          </section>

          <section className="card flex flex-col gap-4 p-5">
            <h2 className="m-0 text-lg font-bold">Ustozni baholash</h2>
            {!d.teachers.length && <div className="text-muted">Farzandingiz guruhiga ustoz biriktirilmagan.</div>}
            {d.teachers.map((t) => {
              const old = d.ratings.find((r) => r.teacher_id === t.id)
              const cur = rate[t.id] ?? { stars: old?.stars ?? 0, comment: old?.comment ?? '' }
              return (
                <div key={t.id} className="flex flex-col gap-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="font-semibold">{t.name}</div>
                  <Stars value={cur.stars} onChange={(v) => setRate({ ...rate, [t.id]: { ...cur, stars: v } })} />
                  <textarea className="input min-h-20 py-2" aria-label="Izoh" placeholder="Izoh (ixtiyoriy)" value={cur.comment}
                    onChange={(e) => setRate({ ...rate, [t.id]: { ...cur, comment: e.target.value } })} />
                  <button className="btn-ghost h-10 self-start" disabled={busy} onClick={() => sendRating(t)}>{old ? 'Bahoni yangilash' : 'Baholash'}</button>
                </div>
              )
            })}
          </section>
        </div>
      )}
    </>
  )
}
