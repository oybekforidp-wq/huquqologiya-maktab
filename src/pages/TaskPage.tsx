import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fileUrl, safeName, uploadFile } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDateTime } from '../lib/format'
import { Badge, ErrorBox, PageHead, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import { KIND_LABEL, type Assignment, type Profile, type Submission } from '../lib/types'

const L = ['A', 'B', 'C', 'D', 'E', 'F']

export default function TaskPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const task = useQuery(async () => {
    const { data, error } = await supabase.rpc('assignment_for_student', { p_assignment: id })
    if (error) throw new Error(error.message)
    return data as Assignment | null
  }, [id])
  const teaches = useQuery(async () => task.data ? !!(await supabase.rpc('teaches', { gid: task.data.group_id })).data : false, [task.data?.id])
  const mine = useQuery(() => must<Submission | null>(supabase.from('submissions').select('*').eq('assignment_id', id!).eq('student_id', profile!.id).maybeSingle()), [id])

  if (task.loading || mine.loading || teaches.loading) return <Spinner />
  const t = task.data
  if (!t) return <ErrorBox text="Vazifa topilmadi" />

  return (
    <>
      <PageHead back="/vazifalar" title={t.title} sub={`${KIND_LABEL[t.kind]}${t.due_at ? ` · muddat: ${fmtDateTime(t.due_at)}` : ''} · ${t.max_score} ball`} />
      {t.instructions && <div className="card mb-5 whitespace-pre-wrap p-5 text-[17px] leading-relaxed">{t.instructions}</div>}
      {teaches.data ? <Review task={t} /> : t.kind === 'test'
        ? <TestRun task={t} sub={mine.data} onDone={() => { mine.reload(); task.reload() }} />
        : <Answer task={t} sub={mine.data} uid={profile!.id} onDone={mine.reload} />}
    </>
  )
}

function TestRun({ task, sub, onDone }: { task: Assignment; sub: Submission | null; onDone: () => void }) {
  const qs = task.questions ?? []
  const [ans, setAns] = useState<Record<number, number>>({})
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const done = !!sub
  const answers: Record<string, number> = done ? sub!.answers : ans
  const q = qs[i]
  if (!q) return <div className="card p-5 text-muted">Bu testda savol yo'q.</div>
  const picked = answers[i]
  const right = (k: number) => done && q.c === k

  const submit = async () => {
    if (Object.keys(ans).length < qs.length && !confirm(`${qs.length - Object.keys(ans).length} ta savolga javob berilmagan. Baribir topshirasizmi?`)) return
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('submit_test', { p_assignment: task.id, p_answers: ans })
    setBusy(false)
    if (error) setErr(error.message); else onDone()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="card flex flex-col gap-3 self-start p-4">
        {done && <div className="text-center"><div className="font-display text-4xl font-bold text-brand">{sub!.score}/{task.max_score}</div><div className="text-sm text-muted">Natija jurnalga yozildi</div></div>}
        <div className="grid grid-cols-5 gap-1.5">
          {qs.map((qq, k) => {
            const a = answers[k]
            const cls = done ? (a === qq.c ? 'bg-green-600 text-white border-0' : 'bg-red-600 text-white border-0') : a !== undefined ? 'bg-brand text-white border-0' : 'border border-field bg-white'
            return <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}-savol`} className={`h-9 cursor-pointer rounded-lg text-sm font-bold ${cls} ${k === i ? 'ring-2 ring-blue-300' : ''}`}>{k + 1}</button>
          })}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="text-sm font-semibold text-muted">Savol {i + 1} / {qs.length}</div>
        <div className="card p-5 text-xl font-semibold leading-snug">{q.q}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {q.o.map((o, k) => {
            const isPicked = picked === k
            const tone = done ? (right(k) ? 'border-green-600 bg-green-50' : isPicked ? 'border-red-600 bg-red-50' : 'border-field bg-white') : isPicked ? 'border-brand bg-brand-soft' : 'border-field bg-white'
            return (
              <button key={k} disabled={done} onClick={() => setAns({ ...ans, [i]: k })}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-base text-ink ${tone}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold">{L[k]}</span>{o}
              </button>
            )
          })}
        </div>
        {done && q.a && <div className="rounded-2xl bg-slate-100 p-4 text-[15px]"><strong>Izoh:</strong> {q.a}</div>}
        {err && <ErrorBox text={err} />}
        <div className="flex justify-between gap-3">
          <button className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Oldingi</button>
          {i < qs.length - 1 ? <button className="btn-primary" onClick={() => setI(i + 1)}>Keyingi →</button>
            : !done && <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Yuborilmoqda…' : 'Testni topshirish'}</button>}
        </div>
      </div>
    </div>
  )
}

function Answer({ task, sub, uid, onDone }: { task: Assignment; sub: Submission | null; uid: string; onDone: () => void }) {
  const [text, setText] = useState(sub?.text_answer ?? '')
  const [files, setFiles] = useState<string[]>(sub?.file_paths ?? [])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const graded = sub?.score != null
  const add = async (list: FileList) => {
    setBusy('Yuklanmoqda…'); setErr(null)
    try {
      const paths = await Promise.all([...list].map((f) => uploadFile(`sub/${task.id}/${uid}/${safeName(f.name)}`, f)))
      setFiles([...files, ...paths])
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }
  const send = async () => {
    if (!text.trim() && !files.length) return setErr('Javob yozing yoki fayl yuklang')
    setBusy('Yuborilmoqda…'); setErr(null)
    const row = { assignment_id: task.id, student_id: uid, text_answer: text.trim() || null, file_paths: files, submitted_at: new Date().toISOString() }
    const { error } = sub ? await supabase.from('submissions').update(row).eq('id', sub.id) : await supabase.from('submissions').insert(row)
    setBusy(null)
    if (error) setErr(error.message); else onDone()
  }
  return (
    <div className="flex flex-col gap-4">
      {graded && (
        <div className="card flex flex-col gap-2 border-green-200 bg-green-50 p-5">
          <div className="text-lg font-bold text-green-800">Baho: {sub!.score} / {task.max_score}</div>
          {sub!.feedback && <div className="whitespace-pre-wrap">{sub!.feedback}</div>}
        </div>
      )}
      {sub && !graded && <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-dark">Javobingiz yuborildi, o'qituvchi tekshiryapti. Tekshirilguncha o'zgartirishingiz mumkin.</div>}
      {task.kind !== 'file' && (
        <label className="label">Javobingiz<textarea className="input min-h-48 py-3 text-base" disabled={graded} value={text} onChange={(e) => setText(e.target.value)} placeholder={task.kind === 'kazus' ? "Vaziyatga huquqiy baho bering, tegishli qonun moddasini ko'rsating…" : ''} /></label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!graded && <label className="btn-ghost cursor-pointer"><Icon name="upload" size={18} />{task.kind === 'file' ? 'Rasm yoki fayl yuklash' : 'Fayl biriktirish'}
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = '' }} /></label>}
        {files.map((p) => <FileChip key={p} path={p} onRemove={graded ? undefined : () => setFiles(files.filter((x) => x !== p))} />)}
      </div>
      {err && <ErrorBox text={err} />}
      {!graded && <div><button className="btn-primary" disabled={!!busy} onClick={send}>{busy ?? (sub ? 'Javobni yangilash' : 'Javobni yuborish')}</button></div>}
    </div>
  )
}

function FileChip({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const name = path.split('/').pop()!.replace(/^\d+_/, '')
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">
      <button className="cursor-pointer border-0 bg-transparent text-brand" onClick={async () => window.open(await fileUrl(path), '_blank')}>{name}</button>
      {onRemove && <button className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent" aria-label="Olib tashlash" onClick={onRemove}>×</button>}
    </span>
  )
}

function Review({ task }: { task: Assignment }) {
  const data = useQuery(async () => {
    const [stu, subs] = await Promise.all([
      must<{ profiles: Profile }[]>(supabase.from('enrollments').select('profiles(*)').eq('group_id', task.group_id)),
      must<Submission[]>(supabase.from('submissions').select('*').eq('assignment_id', task.id)),
    ])
    return { stu: stu.map((s) => s.profiles).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name)), subs }
  }, [task.id])
  const [open, setOpen] = useState<string | null>(null)
  if (data.loading) return <Spinner />
  const { stu, subs } = data.data!
  const doneN = subs.length
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <h2 className="m-0 flex-1 text-lg font-bold">Javoblar</h2>
        <Badge color="blue">{doneN} / {stu.length} topshirdi</Badge>
        {task.kind === 'test' && <Badge>{task.questions?.length ?? 0} savol · avtomatik baholanadi</Badge>}
      </div>
      {!stu.length && <div className="p-5 text-muted">Guruhda o'quvchi yo'q</div>}
      {stu.map((s) => {
        const sub = subs.find((x) => x.student_id === s.id)
        return (
          <div key={s.id} className="border-b border-slate-100 last:border-0">
            <button onClick={() => sub && setOpen(open === s.id ? null : s.id)} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-5 py-3 text-left text-ink hover:bg-bg">
              <span className="flex-1 font-semibold">{s.full_name}</span>
              {!sub ? <Badge color="gray">Topshirmagan</Badge> : sub.score != null ? <Badge color="green">{sub.score} / {task.max_score}</Badge> : <Badge color="amber">Tekshirish kerak</Badge>}
            </button>
            {open === s.id && sub && <Grade task={task} sub={sub} onSaved={() => { data.reload(); setOpen(null) }} />}
          </div>
        )
      })}
    </section>
  )
}

function Grade({ task, sub, onSaved }: { task: Assignment; sub: Submission; onSaved: () => void }) {
  const [score, setScore] = useState(sub.score != null ? String(sub.score) : '')
  const [fb, setFb] = useState(sub.feedback ?? '')
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    const n = Number(score)
    if (score === '' || isNaN(n) || n < 0 || n > task.max_score) return setErr(`0 dan ${task.max_score} gacha ball kiriting`)
    const { error } = await supabase.from('submissions').update({ score: n, feedback: fb.trim() || null, graded_at: new Date().toISOString() }).eq('id', sub.id)
    if (error) setErr(error.message); else onSaved()
  }
  return (
    <div className="flex flex-col gap-3 bg-bg px-5 py-4">
      <div className="text-xs text-muted">Topshirildi: {fmtDateTime(sub.submitted_at)}</div>
      {task.kind === 'test' ? (
        <div className="text-sm">To'g'ri javoblar: {(task.questions ?? []).filter((q, k) => sub.answers[k] === q.c).length} / {task.questions?.length}</div>
      ) : <>
        {sub.text_answer && <div className="whitespace-pre-wrap rounded-xl bg-white p-4">{sub.text_answer}</div>}
        {sub.file_paths.length > 0 && <div className="flex flex-wrap gap-2">{sub.file_paths.map((p) => <FileChip key={p} path={p} />)}</div>}
      </>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="label w-32">Ball<input className="input" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder={`0–${task.max_score}`} /></label>
        <label className="label min-w-60 flex-1">Izoh o'quvchiga<input className="input" value={fb} onChange={(e) => setFb(e.target.value)} /></label>
        <button className="btn-primary" onClick={save}>Saqlash</button>
      </div>
      {err && <ErrorBox text={err} />}
    </div>
  )
}
