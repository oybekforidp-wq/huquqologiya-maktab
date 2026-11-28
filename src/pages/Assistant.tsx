import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { PageHead } from '../components/ui'
import { Icon } from '../components/Icon'

type Source = { law: string; art: string; title: string; url: string }
type Msg = { role: 'user' | 'model'; text: string; sources?: Source[]; error?: boolean }

const STORE = 'qonun-chat-v1'
const EXAMPLES = ['Nikoh yoshi necha yosh?', 'Prezidentlikka nomzodga qanday talablar qoʻyiladi?', 'Oʻgʻrilik uchun qanday jazo belgilangan?', 'Advokatlik siri nima?']

// **qalin** va "- " ro'yxatni oddiy ko'rsatish (HTML'siz, xavfsiz)
function Rich({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p)
  const lines = text.replace(/^#+\s*/gm, '').split('\n')
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((l, i) => {
        const t = l.trim()
        if (!t) return null
        if (/^[-*•]\s+/.test(t)) return <div key={i} className="flex gap-2"><span className="text-brand">•</span><span>{inline(t.replace(/^[-*•]\s+/, ''))}</span></div>
        return <p key={i} className="m-0">{inline(t)}</p>
      })}
    </div>
  )
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') } catch { return [] }
  })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { supabase.rpc('ai_quota_left').then(({ data }) => { if (typeof data === 'number') setLeft(data) }) }, [])
  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30))) } catch { /* bo'sh */ }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, busy])

  const ask = async (qRaw: string) => {
    const q = qRaw.trim()
    if (q.length < 3 || busy) return
    setText('')
    const history = msgs.filter((m) => !m.error).slice(-6).map(({ role, text }) => ({ role, text }))
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('qonun-chat', { body: { question: q, history } })
      let body = data as { answer?: string; sources?: Source[]; left?: number; error?: string } | null
      if (error) {
        // xato javobi tanasidagi matnni olish
        try { body = await (error as { context?: Response }).context?.json() } catch { body = null }
        throw new Error(body?.error || "Yordamchi hozircha ishlamayapti. Keyinroq urinib ko'ring.")
      }
      if (!body?.answer) throw new Error(body?.error || 'Javob olinmadi')
      if (typeof body.left === 'number') setLeft(body.left)
      setMsgs((m) => [...m, { role: 'model', text: body!.answer!, sources: body!.sources ?? [] }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'model', text: (e as Error).message, error: true }])
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHead title="Huquq yordamchisi" sub="Savolingizga kurs doirasidagi qonun matnlari (lex.uz) asosida javob beradi"
        right={msgs.length > 0 ? <button className="btn-ghost h-10 px-3 text-sm" onClick={() => setMsgs([])}>Yangi suhbat</button> : undefined} />

      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Javoblar sun'iy intellekt tomonidan tayyorlanadi va xato bo'lishi mumkin. Har doim ko'rsatilgan moddani lex.uz'da tekshiring.
        Shaxsiy ma'lumot (ism, telefon, manzil) yozmang.
      </div>

      {msgs.length === 0 && (
        <section className="card mb-4 p-5">
          <div className="mb-3 font-semibold">Masalan, so'rang:</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => <button key={e} className="btn-ghost h-auto min-h-10 px-3 py-2 text-left text-sm font-medium" onClick={() => ask(e)}>{e}</button>)}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-3 text-white">{m.text}</div>
        ) : (
          <div key={i} className={`max-w-[95%] self-start rounded-2xl rounded-bl-md px-4 py-3 ${m.error ? 'bg-red-50 text-red-800' : 'card'}`}>
            <Rich text={m.text} />
            {!!m.sources?.length && (
              <div className="mt-3 flex flex-col gap-1 border-t border-line pt-2 text-sm">
                <div className="text-xs font-bold tracking-wide text-muted">MANBALAR</div>
                {m.sources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noreferrer" className="text-brand">
                    {s.law}, {s.art}-modda{s.title ? ` — ${s.title}` : ''}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="card self-start px-4 py-3 text-muted">Qonunlardan qidirilmoqda…</div>}
        <div ref={end} />
      </div>

      <form className="sticky bottom-[76px] mt-4 flex gap-2 rounded-2xl bg-bg/90 py-2 backdrop-blur md:bottom-4"
        onSubmit={(e) => { e.preventDefault(); ask(text) }}>
        <textarea className="input h-auto min-h-12 resize-none py-3" rows={1} maxLength={700} placeholder="Savolingizni yozing…"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text) } }} />
        <button className="btn-primary h-12 shrink-0" disabled={busy || text.trim().length < 3 || left === 0} aria-label="Yuborish">
          <Icon name="send" />
        </button>
      </form>
      <div className="text-center text-xs text-muted">{left === null ? '' : left > 0 ? `Bugun yana ${left} ta savol berish mumkin` : 'Bugungi limit tugadi'}</div>
    </div>
  )
}
