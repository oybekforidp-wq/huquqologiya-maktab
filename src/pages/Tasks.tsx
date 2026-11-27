import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { myGroups } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDateTime } from '../lib/format'
import { Badge, Empty, ErrorBox, PageHead, Spinner } from '../components/ui'
import { GroupTabs, useGroupSel } from '../components/GroupTabs'
import { Icon } from '../components/Icon'
import { BankPicker } from '../components/BankPicker'
import { KIND_LABEL, type Assignment, type AssignmentKind, type Lesson, type Question, type Submission } from '../lib/types'

export default function Tasks() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const groups = useQuery(() => myGroups(profile!), [profile?.id])
  const { gid, pick, group } = useGroupSel(groups.data)
  const staff = profile!.role !== 'student'
  const [form, setForm] = useState(!!params.get('dars'))
  const data = useQuery(async () => {
    if (!gid) return null
    const [tasks, subs] = await Promise.all([
      must<Assignment[]>(supabase.from('assignments').select('id, group_id, lesson_id, title, kind, instructions, due_at, max_score').eq('group_id', gid).order('created_at', { ascending: false })),
      must<Submission[]>(supabase.from('submissions').select('id, assignment_id, student_id, score, graded_at, submitted_at')),
    ])
    return { tasks, subs }
  }, [gid])

  if (groups.loading) return <Spinner />
  if (!gid) return <><PageHead title="Vazifalar" /><Empty title="Kurs topilmadi" /></>

  return (
    <>
      <PageHead title="Vazifalar" sub={group ? `${group.subjects?.name} · ${group.name}` : ''}
        right={staff && <button className="btn-primary" onClick={() => setForm(!form)}><Icon name="plus" />Yangi vazifa</button>} />
      <GroupTabs groups={groups.data!} gid={gid} pick={pick} />
      {form && staff && <NewTask gid={gid} lessonId={params.get('dars')} done={() => { setForm(false); data.reload() }} />}
      {data.loading ? <Spinner /> : !data.data?.tasks.length ? <Empty title="Hozircha vazifa yo'q" /> : (
        <div className="card overflow-hidden">
          {data.data.tasks.map((t) => {
            const subs = data.data!.subs.filter((s) => s.assignment_id === t.id)
            const mine = subs.find((s) => s.student_id === profile!.id)
            const ungraded = subs.filter((s) => s.score == null).length
            return (
              <Link key={t.id} to={`/vazifa/${t.id}`} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 text-ink no-underline last:border-0 hover:bg-bg">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-sm text-muted">{KIND_LABEL[t.kind]}{t.due_at ? ` · muddat: ${fmtDateTime(t.due_at)}` : ''}</div>
                </div>
                {staff ? (
                  <div className="flex gap-2"><Badge>{subs.length} topshirdi</Badge>{ungraded > 0 && <Badge color="amber">{ungraded} tekshirilmagan</Badge>}</div>
                ) : mine ? (mine.score != null ? <Badge color="green">{mine.score} / {t.max_score}</Badge> : <Badge>Tekshirilmoqda</Badge>)
                  : <Badge color={t.due_at && new Date(t.due_at) < new Date() ? 'red' : 'amber'}>Bajarilmagan</Badge>}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

// "1. Savol\nA) ...\n*B) to'g'ri\nC) ...\nIzoh: ..." ko'rinishidagi matnni savollarga aylantiradi
export function parseQuestions(text: string): { list: Question[]; errors: string[] } {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const list: Question[] = []
  const errors: string[] = []
  blocks.forEach((b, bi) => {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
    let q = ''; const o: string[] = []; let c = -1; let a = ''
    for (const line of lines) {
      const m = line.match(/^(\*)?\s*([A-Da-d])\s*[).]\s*(.+)$/)
      if (m) { if (m[1]) c = o.length; o.push(m[3].replace(/\s*\*$/, '')); if (/\*$/.test(m[3])) c = o.length - 1; continue }
      const iz = line.match(/^(izoh|javob)\s*:\s*(.+)$/i)
      if (iz) { a = iz[2]; continue }
      q += (q ? ' ' : '') + line.replace(/^\d+\s*[.)]\s*/, '')
    }
    if (!q || o.length < 2) errors.push(`${bi + 1}-savol: savol yoki variantlar topilmadi`)
    else if (c < 0) errors.push(`${bi + 1}-savol: to'g'ri javob belgilanmagan (* qo'ying)`)
    else list.push({ q, o, c, ...(a ? { a } : {}) })
  })
  return { list, errors }
}

function NewTask({ gid, lessonId, done }: { gid: string; lessonId: string | null; done: () => void }) {
  const lessons = useQuery(() => must<Lesson[]>(supabase.from('lessons').select('id, title, starts_at').eq('group_id', gid).order('starts_at', { ascending: false }).limit(30)), [gid])
  const [kind, setKind] = useState<AssignmentKind>('test')
  const [title, setTitle] = useState('')
  const [instr, setInstr] = useState('')
  const [due, setDue] = useState('')
  const [max, setMax] = useState(5)
  const [lesson, setLesson] = useState(lessonId ?? '')
  const [qtext, setQtext] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parsed = kind === 'test' ? parseQuestions(qtext) : { list: [], errors: [] }

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!title.trim()) return setErr('Vazifa nomini yozing')
    if (kind === 'test' && (!parsed.list.length || parsed.errors.length)) return setErr(parsed.errors[0] ?? 'Kamida bitta savol kiriting')
    if (kind !== 'test' && !instr.trim()) return setErr('Vazifa shartini yozing')
    setBusy(true)
    const { error } = await supabase.from('assignments').insert({
      group_id: gid, lesson_id: lesson || null, title: title.trim(), kind, instructions: instr.trim() || null,
      due_at: due ? new Date(due).toISOString() : null, max_score: max, questions: kind === 'test' ? parsed.list : [],
    })
    setBusy(false)
    if (error) setErr(error.message); else done()
  }

  return (
    <form onSubmit={submit} className="card mb-6 flex flex-col gap-4 p-5">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vazifa turi">
        {(Object.keys(KIND_LABEL) as AssignmentKind[]).map((k) => (
          <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={`h-10 cursor-pointer rounded-full px-4 text-sm ${kind === k ? 'border-0 bg-brand font-semibold text-white' : 'border border-field bg-white text-ink'}`}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="label md:col-span-2">Vazifa nomi<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="12-dars bo'yicha test" /></label>
        <label className="label">Qaysi darsga<select className="input" value={lesson} onChange={(e) => setLesson(e.target.value)}>
          <option value="">— darsga bog'lanmagan —</option>
          {lessons.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select></label>
        <label className="label">Muddat (ixtiyoriy)<input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label className="label">Eng yuqori ball<input className="input" type="number" min={1} max={100} value={max} onChange={(e) => setMax(Number(e.target.value) || 5)} /></label>
      </div>
      <label className="label">{kind === 'kazus' ? 'Kazus matni va savollar' : kind === 'test' ? "Izoh (ixtiyoriy)" : 'Vazifa sharti'}
        <textarea className="input min-h-28 py-3" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={kind === 'kazus' ? "Fuqaro A. 2019-yilda... Savol: A.ning harakatiga huquqiy baho bering." : kind === 'file' ? "Daftaringizdagi ishni rasmga olib yuklang" : ''} />
      </label>
      {kind === 'test' && <BankPicker onAdd={(t) => setQtext((qtext.trim() ? qtext.trim() + '\n\n' : '') + t)} />}
      {kind === 'test' && (
        <label className="label">Savollar — har savol orasida bo'sh qator, to'g'ri javob oldiga * qo'ying
          <textarea className="input min-h-64 py-3 font-mono text-sm" value={qtext} onChange={(e) => setQtext(e.target.value)}
            placeholder={"1. Konstitutsiyaning qaysi moddasida yagona fuqarolik belgilangan?\nA) 8-modda\nB) 19-modda\n*C) 22-modda\nD) 24-modda\nIzoh: 22-modda — butun hududda yagona fuqarolik.\n\n2. Keyingi savol..."} />
          <span className="text-sm font-normal text-muted">{parsed.list.length} ta savol tayyor{parsed.errors.length ? ` · ${parsed.errors[0]}` : ''}</span>
        </label>
      )}
      {err && <ErrorBox text={err} />}
      <div className="flex gap-3"><button className="btn-primary" disabled={busy}>Vazifani berish</button><button type="button" className="btn-ghost" onClick={done}>Bekor qilish</button></div>
    </form>
  )
}
