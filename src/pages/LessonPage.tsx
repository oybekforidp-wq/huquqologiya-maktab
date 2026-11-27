import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fileUrl, safeName, toLocalInput, uploadFile } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDateTime } from '../lib/format'
import { Badge, ErrorBox, PageHead, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import { KIND_LABEL, type Assignment, type CourseLesson, type Lesson, type LessonLinks, type Profile } from '../lib/types'
import { PayNote } from './Lessons'

const Board = lazy(() => import('../components/Board').then((m) => ({ default: m.Board })))

export default function LessonPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const lesson = useQuery(() => must<Lesson>(supabase.from('lessons').select('*').eq('id', id!).single()), [id])
  const [canEdit, setCanEdit] = useState(false)
  const [open, setOpen] = useState<boolean | null>(null)
  const links = useQuery(async () => id ? ((await supabase.from('lesson_links').select('meeting_url, recording_url').eq('lesson_id', id).maybeSingle()).data as LessonLinks | null) : null, [id, open])
  const [err, setErr] = useState<string | null>(null)
  const [ver, setVer] = useState(0)
  const l = lesson.data

  useEffect(() => {
    if (!l) return
    supabase.rpc('teaches', { gid: l.group_id }).then(({ data }) => setCanEdit(!!data))
    supabase.rpc('lesson_open', { lid: l.id }).then(({ data }) => {
      setOpen(!!data)
      if (data && profile!.role === 'student') supabase.rpc('join_lesson', { p_lesson: l.id })
    })
  }, [l?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dars holati (jonli/yakunlangan) o'zgarsa darhol yangilanadi
  useEffect(() => {
    if (!id) return
    const ch = supabase.channel('lesson-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lessons', filter: `id=eq.${id}` }, () => lesson.reload())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (lesson.loading && !l) return <Spinner />
  if (!l) return <ErrorBox text="Dars topilmadi" />
  if (open === null) return <Spinner />
  if (!open) return (
    <>
      <PageHead back="/darslar" title={l.title} sub={fmtDateTime(l.starts_at)} right={<Badge color="amber">🔒 Yopiq</Badge>} />
      <PayNote />
    </>
  )
  const lk = links.data

  const set = async (patch: Partial<Lesson>) => {
    setErr(null)
    const { error } = await supabase.from('lessons').update(patch).eq('id', l.id)
    if (error) setErr(error.message); else lesson.reload()
  }

  return (
    <>
      <PageHead back="/darslar" title={l.title} sub={fmtDateTime(l.starts_at)}
        right={<div className="flex flex-wrap items-center gap-2">
          {l.is_live ? <Badge color="red">● Jonli</Badge> : l.ended_at ? <Badge>Yakunlangan</Badge> : <Badge color="blue">Rejada</Badge>}
          {lk?.meeting_url && !l.ended_at && <a href={lk.meeting_url} target="_blank" rel="noreferrer" className="btn-primary no-underline">Video darsga kirish</a>}
          {canEdit && !l.is_live && !l.ended_at && <button className="btn-primary" onClick={() => set({ is_live: true })}>Darsni boshlash</button>}
          {canEdit && l.is_live && <button className="btn-ghost" onClick={() => confirm('Dars yakunlansinmi? Doska saqlanadi.') && set({ is_live: false, ended_at: new Date().toISOString() })}>Darsni yakunlash</button>}
        </div>} />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}

      {lk?.recording_url && (
        <a href={lk.recording_url} target="_blank" rel="noreferrer" className="card mb-5 flex items-center gap-3 p-4 font-semibold no-underline">▶ Dars videosini ko'rish</a>
      )}

      <section className="mb-6">
        <Suspense fallback={<Spinner label="Doska yuklanmoqda…" />}>
          <Board lessonId={l.id} canEdit={canEdit} live={l.is_live} />
        </Suspense>
        {!canEdit && l.is_live && <p className="mt-2 text-sm text-muted">O'qituvchi doskada nima yozsa, shu yerda darhol ko'rinadi.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {canEdit && <CourseAttach lesson={l} done={() => { setVer((v) => v + 1); lesson.reload() }} />}
        <Files key={'f' + ver} lessonId={l.id} canEdit={canEdit} />
        <LessonTasks key={'t' + ver} lesson={l} />
        {canEdit && !links.loading && <Settings lesson={l} links={lk} save={set} saveLinks={async (v) => { setErr(null); const { error } = await supabase.from('lesson_links').upsert({ lesson_id: l.id, ...v }); if (error) setErr(error.message); else links.reload() }} />}
        {canEdit && <Attendance lesson={l} />}
      </div>
    </>
  )
}

// Kurs shablonidan "Dars N" biriktirish: dars PDF + sinf/uy testlari + yozma + kazus. Kalit faqat ustozga.
function CourseAttach({ lesson, done }: { lesson: Lesson; done: () => void }) {
  const list = useQuery(async () => {
    const g = await must<{ subject_id: string }>(supabase.from('groups').select('subject_id').eq('id', lesson.group_id).single())
    return must<CourseLesson[]>(supabase.from('course_lessons').select('id, subject_id, num, title, module, type, pdf_path, key_path, updated_at').eq('subject_id', g.subject_id).order('num'))
  }, [lesson.group_id])
  const cur = useQuery(async () => (await supabase.rpc('course_lesson_for_staff', { p_lesson: lesson.id })).data as CourseLesson | null, [lesson.id, lesson.title])
  const [num, setNum] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  if (list.loading) return null
  if (!list.data?.length) return null
  const attach = async () => {
    const n = Number(num || cur.data?.num)
    if (!n) return
    if (cur.data && !confirm(`Avvalgi biriktirish (${cur.data.num}-dars) almashtirilsinmi? Javob topshirilgan vazifalar saqlanadi.`)) return
    setBusy(true); setErr(null); setMsg(null)
    const { data, error } = await supabase.rpc('attach_course_lesson', { p_lesson: lesson.id, p_num: n, p_set_title: true })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`${data.num}-dars biriktirildi: fayl + ${data.assignments} ta vazifa.`)
    cur.reload(); done()
  }
  const open = async (p: string) => window.open(await fileUrl('kurs/' + p), '_blank')
  return (
    <section className="card flex flex-col gap-3 p-5 lg:col-span-2">
      <h2 className="m-0 text-lg font-bold">Kurs dasturidan dars</h2>
      {cur.data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge color="green">{cur.data.num}-dars biriktirilgan</Badge>
          {cur.data.key_path && <button className="btn-ghost h-8 px-3 text-sm" onClick={() => open(cur.data!.key_path!)}>🔑 Kalit (faqat ustoz)</button>}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="label min-w-60 flex-1">Dars
          <select className="input" value={num || String(cur.data?.num ?? '')} onChange={(e) => setNum(e.target.value)}>
            <option value="">— tanlang —</option>
            {list.data.map((d) => <option key={d.id} value={d.num}>{d.num}-dars. {d.title.slice(0, 90)}</option>)}
          </select>
        </label>
        <button className="btn-primary h-12" disabled={busy || !(num || cur.data)} onClick={attach}>{busy ? 'Biriktirilmoqda…' : 'Biriktirish'}</button>
      </div>
      <p className="m-0 text-sm text-muted">Biriktirilganda dars PDF fayli, sinf testi, uy testi, yozma topshiriq va kazus vazifalari yaratiladi. O'quvchi ularni faqat to'lov amal qilsa (yoki birinchi tekin darsda) ko'radi.</p>
      {msg && <div className="text-sm font-semibold text-green-700">{msg}</div>}
      {err && <ErrorBox text={err} />}
    </section>
  )
}

function Files({ lessonId, canEdit }: { lessonId: string; canEdit: boolean }) {
  const files = useQuery(() => must<{ id: string; name: string; path: string }[]>(supabase.from('lesson_files').select('*').eq('lesson_id', lessonId).order('created_at')), [lessonId])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const add = async (f: File) => {
    setBusy(true); setErr(null)
    try {
      const path = await uploadFile(`${lessonId}/files/${safeName(f.name)}`, f)
      const { error } = await supabase.from('lesson_files').insert({ lesson_id: lessonId, name: f.name, path })
      if (error) throw new Error(error.message)
      files.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const open = async (path: string) => window.open(await fileUrl(path), '_blank')
  const del = async (id: string) => { await supabase.from('lesson_files').delete().eq('id', id); files.reload() }
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold">Dars fayllari</h2>
        {canEdit && <label className="btn-ghost h-9 cursor-pointer px-3 text-sm"><Icon name="upload" size={16} />{busy ? 'Yuklanmoqda…' : 'Fayl qo\'shish'}
          <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) add(f); e.target.value = '' }} /></label>}
      </div>
      {err && <ErrorBox text={err} />}
      {!files.data?.length && <div className="text-sm text-muted">Fayl yo'q</div>}
      <div className="flex flex-col gap-1">
        {files.data?.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <button className="flex-1 cursor-pointer truncate rounded-lg border-0 bg-transparent px-2 py-2 text-left text-brand hover:bg-bg" onClick={() => open(f.path)}>{f.name}</button>
            {canEdit && <button className="btn-ghost h-8 px-2" aria-label="O'chirish" onClick={() => del(f.id)}><Icon name="trash" size={16} /></button>}
          </div>
        ))}
      </div>
    </section>
  )
}

function LessonTasks({ lesson }: { lesson: Lesson }) {
  const tasks = useQuery(() => must<Assignment[]>(supabase.from('assignments').select('id, group_id, lesson_id, title, kind, instructions, due_at, max_score').eq('lesson_id', lesson.id)), [lesson.id])
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg font-bold">Shu dars vazifalari</h2>
        <Link to={`/vazifalar?dars=${lesson.id}`} className="text-sm font-semibold">Vazifalar</Link>
      </div>
      {!tasks.data?.length && <div className="text-sm text-muted">Vazifa yo'q</div>}
      {tasks.data?.map((t) => (
        <Link key={t.id} to={`/vazifa/${t.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-ink no-underline hover:bg-bg">
          <span className="font-semibold">{t.title}</span><Badge>{KIND_LABEL[t.kind]}</Badge>
        </Link>
      ))}
    </section>
  )
}

function Settings({ lesson, links, save, saveLinks }: { lesson: Lesson; links: LessonLinks | null; save: (p: Partial<Lesson>) => Promise<void>; saveLinks: (v: LessonLinks) => Promise<void> }) {
  const [title, setTitle] = useState(lesson.title)
  const [at, setAt] = useState(toLocalInput(lesson.starts_at))
  const [url, setUrl] = useState(links?.meeting_url ?? '')
  const [rec, setRec] = useState(links?.recording_url ?? '')
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="m-0 text-lg font-bold">Dars sozlamalari</h2>
      <label className="label">Mavzu<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="label">Vaqti<input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
      <label className="label">Video havola (Zoom / Meet)<input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="label">Dars yozuvi havolasi (YouTube yopiq / Google Drive)<input className="input" value={rec} onChange={(e) => setRec(e.target.value)} /></label>
      <div><button className="btn-primary" onClick={async () => { await saveLinks({ meeting_url: url.trim() || null, recording_url: rec.trim() || null }); await save({ title, starts_at: new Date(at).toISOString() }) }}>Saqlash</button></div>
    </section>
  )
}

const ATT = [['present', 'Keldi', 'green'], ['late', 'Kech', 'amber'], ['absent', 'Kelmadi', 'red']] as const

function Attendance({ lesson }: { lesson: Lesson }) {
  const data = useQuery(async () => {
    const [stu, att] = await Promise.all([
      must<{ profiles: Profile }[]>(supabase.from('enrollments').select('profiles(*)').eq('group_id', lesson.group_id)),
      must<{ student_id: string; status: string }[]>(supabase.from('attendance').select('student_id, status').eq('lesson_id', lesson.id)),
    ])
    return { stu: stu.map((s) => s.profiles).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name)), att: new Map(att.map((a) => [a.student_id, a.status])) }
  }, [lesson.id])
  const mark = async (sid: string, status: string) => {
    await supabase.from('attendance').upsert({ lesson_id: lesson.id, student_id: sid, status, marked_at: new Date().toISOString() })
    data.reload()
  }
  return (
    <section className="card p-5 lg:col-span-1">
      <h2 className="m-0 mb-1 text-lg font-bold">Yo'qlama</h2>
      <p className="m-0 mb-3 text-sm text-muted">Darsga kirgan o'quvchi avtomatik "Keldi" bo'ladi (10 daqiqadan keyin "Kech").</p>
      {data.loading ? <Spinner /> : !data.data?.stu.length ? <div className="text-sm text-muted">Guruhda o'quvchi yo'q</div> : (
        <div className="flex flex-col">
          {data.data.stu.map((s) => {
            const st = data.data!.att.get(s.id)
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0">
                <span className="min-w-32 flex-1">{s.full_name}</span>
                {ATT.map(([v, label, c]) => (
                  <button key={v} onClick={() => mark(s.id, v)} aria-pressed={st === v}
                    className={`h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold ${st === v ? (c === 'green' ? 'border-0 bg-green-600 text-white' : c === 'amber' ? 'border-0 bg-amber-500 text-white' : 'border-0 bg-red-600 text-white') : 'border border-field bg-white text-ink'}`}>{label}</button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
