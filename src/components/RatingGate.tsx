import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errText } from '../lib/format'
import { ErrorBox } from './ui'
import { Stars } from './Stars'

export interface PendingRating { lesson_id: string; lesson_title: string; teacher_id: string; teacher_name: string; ended_at: string }

// Yopib bo'lmaydigan to'liq ekranli baholash oynasi
export function RatingModal({ p, onDone }: { p: PendingRating; onDone: () => void }) {
  const { profile } = useAuth()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send() {
    if (!stars) return setErr('Yulduzlar sonini tanlang')
    setBusy(true); setErr(null)
    const { error } = await supabase.from('lesson_ratings').insert({
      lesson_id: p.lesson_id, student_id: profile!.id, teacher_id: p.teacher_id, stars, comment: comment.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(errText(error))
    setStars(0); setComment('')
    onDone()
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rate-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg px-5 py-8">
      <div className="card flex w-full max-w-md flex-col gap-5 p-6">
        <div>
          <h1 id="rate-title" className="m-0 font-display text-2xl font-bold">Darsni baholang</h1>
          <p className="mb-0 mt-2 text-muted">«{p.lesson_title}» tugadi. Davom etish uchun ustoz {p.teacher_name} ishini baholang.</p>
        </div>
        <div className="flex justify-center"><Stars value={stars} onChange={setStars} size={44} /></div>
        <label className="label">Izoh (ixtiyoriy)
          <textarea className="input min-h-24 py-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Dars sizga qanday bo'ldi?" />
        </label>
        {err && <ErrorBox text={err} />}
        <button className="btn-primary h-12" disabled={busy} onClick={send}>{busy ? 'Kuting…' : 'Yuborish'}</button>
      </div>
    </div>
  )
}
