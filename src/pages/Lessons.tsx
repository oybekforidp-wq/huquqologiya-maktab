import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { myGroups } from '../lib/data'
import { useQuery, must } from '../lib/useQuery'
import { fmtDateTime } from '../lib/format'
import { Badge, Empty, ErrorBox, PageHead, Spinner } from '../components/ui'
import { GroupTabs, useGroupSel } from '../components/GroupTabs'
import { Icon } from '../components/Icon'
import type { GroupAccess, Lesson } from '../lib/types'

export default function Lessons() {
  const { profile } = useAuth()
  const groups = useQuery(() => myGroups(profile!), [profile?.id])
  const { gid, pick, group } = useGroupSel(groups.data)
  const staff = profile!.role !== 'student'
  const lessons = useQuery(async () => gid ? must<Lesson[]>(supabase.from('lessons').select('*').eq('group_id', gid).order('starts_at', { ascending: false })) : [], [gid])
  const [form, setForm] = useState(false)
  const access = useQuery(async () => gid ? (await supabase.rpc('group_access', { gid })).data as GroupAccess | null : null, [gid])
  const locked = (l: Lesson) => !staff && !!access.data && !access.data.staff && !access.data.paid && access.data.free_lesson !== l.id

  if (groups.loading) return <Spinner />
  if (!gid) return <><PageHead title="Darslar" /><Empty title="Kurs topilmadi" text="Admin sizni guruhga qo'shgach, darslar shu yerda chiqadi." /></>

  const now = Date.now()
  const list = lessons.data ?? []
  const upcoming = list.filter((l) => !l.ended_at && new Date(l.starts_at).getTime() > now - 3 * 3600e3).reverse()
  const past = list.filter((l) => !upcoming.includes(l))

  return (
    <>
      <PageHead title="Darslar" sub={group ? `${group.subjects?.name} · ${group.name}` : ''}
        right={staff && <button className="btn-primary" onClick={() => setForm(!form)}><Icon name="plus" />Yangi dars</button>} />
      <GroupTabs groups={groups.data!} gid={gid} pick={pick} />
      {!staff && access.data && !access.data.paid && list.length > 1 && <PayNote />}
      {form && <NewLesson gid={gid} done={() => { setForm(false); lessons.reload() }} />}
      {lessons.loading ? <Spinner /> : !list.length ? (
        <Empty title="Hali dars yo'q" text={staff ? '"Yangi dars" tugmasi bilan birinchi darsni rejalashtiring.' : "O'qituvchi dars qo'shganda shu yerda chiqadi."} />
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length > 0 && <Section title="Yaqin darslar" items={upcoming} locked={locked} />}
          {past.length > 0 && <Section title="O'tilgan darslar (yozuv va doska)" items={past} locked={locked} />}
        </div>
      )}
    </>
  )
}

function Section({ title, items, locked }: { title: string; items: Lesson[]; locked: (l: Lesson) => boolean }) {
  return (
    <section>
      <h2 className="m-0 mb-3 text-lg font-bold">{title}</h2>
      <div className="card overflow-hidden">
        {items.map((l) => (
          <Link key={l.id} to={`/dars/${l.id}`} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 text-ink no-underline last:border-0 hover:bg-bg">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon name={l.ended_at ? 'board' : 'clock'} /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{l.title}</div>
              <div className="text-sm text-muted">{fmtDateTime(l.starts_at)}</div>
            </div>
            {locked(l) ? <Badge color="amber">🔒 To'lovdan keyin</Badge> : l.is_live ? <Badge color="red">● Jonli</Badge> : l.ended_at ? <Badge>Yozuv</Badge> : <Badge color="blue">Rejada</Badge>}
          </Link>
        ))}
      </div>
    </section>
  )
}

function NewLesson({ gid, done }: { gid: string; done: () => void }) {
  const [title, setTitle] = useState('')
  const [at, setAt] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !at) return setErr('Mavzu va vaqtni kiriting')
    setBusy(true); setErr(null)
    const { data, error } = await supabase.from('lessons').insert({ group_id: gid, title: title.trim(), starts_at: new Date(at).toISOString() }).select('id').single()
    if (!error && url.trim()) await supabase.from('lesson_links').upsert({ lesson_id: data.id, meeting_url: url.trim() })
    setBusy(false)
    if (error) setErr(error.message); else done()
  }
  return (
    <form onSubmit={submit} className="card mb-6 grid gap-4 p-5 md:grid-cols-2">
      <label className="label md:col-span-2">Dars mavzusi<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="13-dars: Vatandoshlar va ularning huquqlari" /></label>
      <label className="label">Boshlanish vaqti<input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
      <label className="label">Video havola (Zoom / Google Meet, ixtiyoriy)<input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/..." /></label>
      {err && <div className="md:col-span-2"><ErrorBox text={err} /></div>}
      <div className="flex gap-3 md:col-span-2"><button className="btn-primary" disabled={busy}>Saqlash</button><button type="button" className="btn-ghost" onClick={done}>Bekor qilish</button></div>
    </form>
  )
}

export function PayNote() {
  return (
    <div className="card mb-5 border-l-4 border-amber-500 p-4 text-sm">
      <b>Birinchi dars tekin.</b> Keyingi darslar, doska, fayllar va vazifalar to'lov tasdiqlangandan keyin ochiladi.
      To'lov va savollar uchun: Telegram <a href="https://t.me/huquqologiya_admin" target="_blank" rel="noreferrer">@huquqologiya_admin</a> · <a href="tel:+998939778800">+998 93 977 88 00</a>
    </div>
  )
}
