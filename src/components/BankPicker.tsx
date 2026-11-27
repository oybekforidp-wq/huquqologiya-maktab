import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, must } from '../lib/useQuery'
import { Spinner } from './ui'

interface BankQ { id: string; grade: string | null; topic: string | null; q: string; options: string[]; correct: number; explanation: string | null }

const L = ['A', 'B', 'C', 'D', 'E', 'F']
export const toPaste = (list: BankQ[]) => list.map((x, i) =>
  [`${i + 1}. ${x.q}`, ...x.options.map((o, k) => `${k === x.correct ? '*' : ''}${L[k]}) ${o}`), ...(x.explanation ? [`Izoh: ${x.explanation.replace(/\n/g, ' ')}`] : [])].join('\n')).join('\n\n')

// Savollar bazasidan (botdagi 8–11-sinf testlari) tanlab vazifaga qo'shish
export function BankPicker({ onAdd }: { onAdd: (text: string, n: number) => void }) {
  const topics = useQuery(async () => {
    const rows = await must<{ grade: string; topic: string }[]>(supabase.from('question_bank').select('grade, topic').limit(10000))
    const m = new Map<string, Set<string>>()
    rows.forEach((r) => { if (!m.has(r.grade)) m.set(r.grade, new Set()); m.get(r.grade)!.add(r.topic) })
    return [...m.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([g, t]) => ({ g, t: [...t] }))
  })
  const [grade, setGrade] = useState('')
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const qs = useQuery(async () => {
    if (!grade) return [] as BankQ[]
    let q = supabase.from('question_bank').select('id, grade, topic, q, options, correct, explanation').eq('grade', grade).limit(400)
    if (topic) q = q.eq('topic', topic)
    if (search.trim().length > 2) q = q.ilike('q', `%${search.trim()}%`)
    return must<BankQ[]>(q)
  }, [grade, topic, search])
  const tlist = useMemo(() => topics.data?.find((x) => x.g === grade)?.t ?? [], [topics.data, grade])
  const list = qs.data ?? []
  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s) }
  const random = (n: number) => { const pool = [...list].sort(() => Math.random() - 0.5).slice(0, n); setSel(new Set(pool.map((x) => x.id))) }
  const add = () => { const chosen = list.filter((x) => sel.has(x.id)); if (chosen.length) { onAdd(toPaste(chosen), chosen.length); setSel(new Set()) } }

  if (topics.loading) return <Spinner />
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-4">
      <div className="text-sm font-semibold">Savollar bazasidan tanlash (botdagi testlar)</div>
      <div className="grid gap-3 md:grid-cols-3">
        <select className="input" value={grade} onChange={(e) => { setGrade(e.target.value); setTopic(''); setSel(new Set()) }} aria-label="Sinf">
          <option value="">Sinfni tanlang</option>
          {topics.data?.map((x) => <option key={x.g} value={x.g}>{x.g}</option>)}
        </select>
        <select className="input" value={topic} onChange={(e) => { setTopic(e.target.value); setSel(new Set()) }} disabled={!grade} aria-label="Mavzu">
          <option value="">Barcha mavzular</option>
          {tlist.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Savol matnidan qidirish" value={search} onChange={(e) => setSearch(e.target.value)} disabled={!grade} />
      </div>
      {grade && (qs.loading ? <Spinner /> : <>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{list.length} ta savol · {sel.size} tanlandi</span>
          <span className="flex-1" />
          {[10, 20, 30].map((n) => <button type="button" key={n} className="btn-ghost h-8 px-3 text-xs" onClick={() => random(n)}>Tasodifiy {n}</button>)}
          <button type="button" className="btn-primary h-8 px-3 text-xs" disabled={!sel.size} onClick={add}>Tanlanganlarni qo'shish</button>
        </div>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-xl bg-white p-2">
          {list.map((x) => (
            <label key={x.id} className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 text-sm hover:bg-bg">
              <input type="checkbox" checked={sel.has(x.id)} onChange={() => toggle(x.id)} className="mt-1" />
              <span><span className="font-semibold">{x.q}</span><span className="block text-xs text-muted">To'g'ri: {x.options[x.correct]}</span></span>
            </label>
          ))}
        </div>
      </>)}
    </div>
  )
}
