import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fileUrl, getSubjects } from '../../lib/data'
import { useQuery, must } from '../../lib/useQuery'
import { Badge, Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import { Icon } from '../../components/Icon'
import type { CourseLesson } from '../../lib/types'

// Fayl nomlari: 05-dars.pdf (o'quvchi), 05-dars_kalit.pdf (kalit), 05-dars.json (testlar)
const NAME_RE = /^(\d{1,3})-dars(_kalit)?\.(pdf|json)$/i

export default function CourseTemplate() {
  const subjects = useQuery(getSubjects)
  const [sid, setSid] = useState('')
  const subjectId = sid || subjects.data?.find((s) => /huquq/i.test(s.name))?.id || subjects.data?.[0]?.id || ''
  const list = useQuery(async () => subjectId
    ? must<CourseLesson[]>(supabase.from('course_lessons').select('id, subject_id, num, title, module, type, pdf_path, key_path, updated_at').eq('subject_id', subjectId).order('num'))
    : [], [subjectId])
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const importFiles = async (files: File[]) => {
    setBusy(true); setErr(null); setLog([])
    const by = new Map<number, { pdf?: File; key?: File; json?: File }>()
    for (const f of files) {
      const m = f.name.match(NAME_RE)
      if (!m) continue
      const n = Number(m[1]); const e = by.get(n) ?? {}
      if (m[3].toLowerCase() === 'json') e.json = f; else if (m[2]) e.key = f; else e.pdf = f
      by.set(n, e)
    }
    const nums = [...by.keys()].sort((a, b) => a - b)
    if (!nums.length) { setErr("Mos fayl topilmadi. Nomlar: 05-dars.pdf, 05-dars_kalit.pdf, 05-dars.json"); setBusy(false); return }
    const up = async (path: string, f: File) => {
      const { error } = await supabase.storage.from('kurs').upload(path, f, { upsert: true, contentType: f.type || 'application/pdf' })
      if (error) throw new Error(`${f.name}: ${error.message}`)
      return path
    }
    for (const n of nums) {
      const e = by.get(n)!; const nn = String(n).padStart(2, '0')
      try {
        if (!e.json) throw new Error(`${nn}-dars.json yo'q`)
        const c = JSON.parse(await e.json.text())
        const row: Record<string, unknown> = {
          subject_id: subjectId, num: n, title: c.title || `${n}-dars`, module: c.module || null, type: c.type || null,
          content: { sinf: c.sinf ?? [], uy: c.uy ?? [], ochiq: c.ochiq ?? [], kazus: c.kazus ?? [], yozma: c.yozma ?? '', case: c.case ?? '' },
          updated_at: new Date().toISOString(),
        }
        if (e.pdf) row.pdf_path = await up(`${subjectId}/${nn}-dars.pdf`, e.pdf)
        if (e.key) row.key_path = await up(`${subjectId}/${nn}-dars_kalit.pdf`, e.key)
        const { error } = await supabase.from('course_lessons').upsert(row, { onConflict: 'subject_id,num' })
        if (error) throw new Error(error.message)
        setLog((l) => [...l, `✓ ${n}-dars`])
      } catch (x) { setLog((l) => [...l, `✗ ${n}-dars: ${(x as Error).message}`]) }
    }
    setBusy(false); list.reload()
  }

  const open = async (p: string) => window.open(await fileUrl('kurs/' + p), '_blank')

  if (subjects.loading) return <Spinner />
  return (
    <>
      <PageHead title="Kurs shabloni" sub="Sanasiz darslar (1-dars, 2-dars…). Ustoz guruh darsiga istalgan darsni biriktiradi. Kalitlar faqat ustoz va admin'ga ko'rinadi." />
      {err && <div className="mb-4"><ErrorBox text={err} /></div>}
      <section className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="label min-w-60 flex-1">Fan
          <select className="input" value={subjectId} onChange={(e) => setSid(e.target.value)}>
            {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={`btn-primary h-12 cursor-pointer ${busy ? 'opacity-60' : ''}`}><Icon name="upload" />{busy ? 'Yuklanmoqda…' : 'Fayllarni tanlash'}
          <input type="file" multiple accept=".pdf,.json" className="sr-only" disabled={busy || !subjectId}
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) importFiles(fs) }} /></label>
        <p className="m-0 w-full text-sm text-muted">Bir vaqtda ko'p fayl tanlash mumkin: <b>NN-dars.pdf</b>, <b>NN-dars_kalit.pdf</b>, <b>NN-dars.json</b>. Qayta yuklansa, yangilanadi.</p>
        {log.length > 0 && <div className="w-full text-sm">{log.join(' · ')}</div>}
      </section>

      {list.loading ? <Spinner /> : !list.data?.length ? <Empty title="Shablonda dars yo'q" text="Fayllarni tanlab yuklang." /> : (
        <section className="card divide-y divide-slate-100 p-2">
          {list.data.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="w-10 font-bold">{d.num}</span>
              <span className="min-w-48 flex-1">{d.title}</span>
              {d.type === 'nazorat' && <Badge color="amber">Nazorat</Badge>}
              {d.pdf_path && <button className="btn-ghost h-8 px-2 text-xs" onClick={() => open(d.pdf_path!)}>PDF</button>}
              {d.key_path && <button className="btn-ghost h-8 px-2 text-xs" onClick={() => open(d.key_path!)}>Kalit</button>}
            </div>
          ))}
        </section>
      )}
    </>
  )
}
