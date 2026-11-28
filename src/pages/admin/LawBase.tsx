import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import { ErrorBox, PageHead, Stat } from '../../components/ui'
import { Icon } from '../../components/Icon'

type Row = [string, string, string, string, string] // law_key, art, title, chapter, body

// Qonun matnlari saytning o'zida: /qonunlar/*.json (lex.uz'dan olingan ochiq matnlar)
export default function LawBase() {
  const stats = useQuery(async () => {
    const [d, a] = await Promise.all([
      supabase.from('law_docs').select('key', { count: 'exact', head: true }),
      supabase.from('law_articles').select('id', { count: 'exact', head: true }),
    ])
    return { docs: d.count ?? 0, arts: a.count ?? 0, err: d.error?.message || a.error?.message }
  })
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setBusy(true); setErr(null)
    try {
      const base = import.meta.env.BASE_URL + 'qonunlar/'
      const get = async (f: string) => { const r = await fetch(base + f, { cache: 'no-store' }); if (!r.ok) throw new Error(f + ' topilmadi'); return r.json() }
      const idx = await get('index.json') as { parts: number }
      const laws = await get('laws.json') as { key: string; name: string; url: string }[]
      setLog('Eski maʼlumotlar oʻchirilmoqda…')
      let r = await supabase.from('law_articles').delete().gte('id', 0)
      if (r.error) throw new Error(r.error.message)
      r = await supabase.from('law_docs').upsert(laws, { onConflict: 'key' })
      if (r.error) throw new Error(r.error.message)
      let done = 0
      for (let p = 1; p <= idx.parts; p++) {
        const rows = await get(`moddalar-${p}.json`) as Row[]
        for (let i = 0; i < rows.length; i += 150) {
          const batch = rows.slice(i, i + 150).map(([law_key, art, title, chapter, body]) => ({ law_key, art, title, chapter, body }))
          const x = await supabase.from('law_articles').insert(batch)
          if (x.error) throw new Error(x.error.message)
          done += batch.length
          setLog(`Yuklandi: ${done} ta modda`)
        }
      }
      setLog(`Tayyor: ${laws.length} ta hujjat, ${done} ta modda`)
      stats.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Qonunlar bazasi" sub="Huquq yordamchisi (AI) shu bazadan qidiradi. Matnlar yangilansa, qayta yuklang." />
      {(err || stats.data?.err) && <div className="mb-4"><ErrorBox text={err || stats.data!.err!} /></div>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:max-w-md">
        <Stat label="Hujjatlar" value={stats.data?.docs ?? '…'} />
        <Stat label="Moddalar" value={stats.data?.arts ?? '…'} />
      </div>
      <section className="card flex flex-wrap items-center gap-3 p-4">
        <button className="btn-primary" disabled={busy} onClick={load}><Icon name="upload" />{busy ? 'Yuklanmoqda…' : 'Bazani yuklash / yangilash'}</button>
        <span className="text-sm text-muted">{log}</span>
      </section>
    </>
  )
}
