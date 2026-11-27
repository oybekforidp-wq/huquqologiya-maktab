import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useQuery, must } from '../../lib/useQuery'
import { fmtDate } from '../../lib/format'
import { Badge, ErrorBox, PageHead, Spinner, Stat } from '../../components/ui'
import { KIND_LABEL, type ChildReport } from '../../lib/types'

const ATT = { present: ['Keldi', 'green'], late: ['Kech qoldi', 'amber'], absent: ['Kelmadi', 'red'] } as const

export default function ChildPage() {
  const { id } = useParams()
  const rep = useQuery(() => must<ChildReport>(supabase.rpc('child_report', { p_student: id })), [id])
  const d = rep.data

  const avg = (() => {
    if (!d) return '—'
    const v = [...d.grades.map((g) => g.value), ...d.tasks.filter((t) => t.score != null).map((t) => (Number(t.score) / t.max_score) * 5)]
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '—'
  })()
  const att = d ? d.lessons.filter((l) => l.status === 'present' || l.status === 'late').length : 0

  return (
    <>
      <PageHead title={d?.student.full_name ?? 'Farzand'} sub="Kuzatuv sahifasi (faqat o'qish)" back="/" />
      {rep.error && <ErrorBox text={rep.error} />}
      {rep.loading || !d ? <Spinner /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="O'rtacha baho" value={avg} />
            <Stat label="Davomat" value={d.lessons.length ? `${Math.round((att / d.lessons.length) * 100)}%` : '—'} />
            <Stat label="Topshirilgan" value={`${d.tasks.filter((t) => t.submitted_at).length} / ${d.tasks.length}`} />
          </div>

          <section className="card overflow-hidden">
            <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Guruhlar</h2>
            {!d.groups.length && <div className="p-5 text-muted">Guruhga qo'shilmagan</div>}
            {d.groups.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{g.subject} · {g.name}</div>
                  <div className="text-sm text-muted">Ustoz: {g.teacher_name ?? '—'}</div>
                </div>
                {g.paid_until ? <Badge color="green">To'lov: {g.paid_until} gacha</Badge> : <Badge color="amber">To'lov yo'q</Badge>}
              </div>
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Davomat (darslar)</h2>
              {!d.lessons.length && <div className="p-5 text-muted">Hali dars bo'lmagan</div>}
              {d.lessons.map((l) => {
                const v = ATT[l.status ?? 'absent']
                return (
                  <div key={l.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1"><div className="font-semibold">{l.title}</div><div className="text-sm text-muted">{fmtDate(l.starts_at)}</div></div>
                    <Badge color={v[1]}>{v[0]}</Badge>
                  </div>
                )
              })}
            </section>

            <section className="card overflow-hidden">
              <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Vazifalar va ballar</h2>
              {!d.tasks.length && <div className="p-5 text-muted">Vazifa yo'q</div>}
              {d.tasks.map((t) => (
                <div key={t.id} className="border-b border-slate-100 px-5 py-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1"><div className="font-semibold">{t.title}</div><div className="text-sm text-muted">{KIND_LABEL[t.kind]}</div></div>
                    {t.submitted_at ? (t.score != null ? <Badge color="green">{t.score} / {t.max_score}</Badge> : <Badge>Tekshirilmoqda</Badge>) : <Badge color="amber">Bajarilmagan</Badge>}
                  </div>
                  {t.feedback && <div className="mt-2 rounded-lg bg-bg px-3 py-2 text-sm"><span className="font-semibold">Ustoz izohi:</span> {t.feedback}</div>}
                </div>
              ))}
            </section>
          </div>

          <section className="card overflow-hidden">
            <h2 className="m-0 border-b border-line px-5 py-4 text-lg font-bold">Jurnal baholari</h2>
            {!d.grades.length && <div className="p-5 text-muted">Baho qo'yilmagan</div>}
            {d.grades.map((g) => (
              <div key={g.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1"><div className="text-sm text-muted">{fmtDate(g.created_at)}</div>{g.note && <div>{g.note}</div>}</div>
                <Badge color="blue">{g.value}</Badge>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  )
}
