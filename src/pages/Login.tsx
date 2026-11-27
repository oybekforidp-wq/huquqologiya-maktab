import { useState, type FormEvent } from 'react'
import { supabase, loginToEmail, LOGIN_RE } from '../lib/supabase'
import { errText } from '../lib/format'
import { ErrorBox } from '../components/ui'
import { ROLE_LABEL } from '../lib/types'

type SignupRole = 'student' | 'teacher' | 'parent'
const SIGNUP_ROLES: SignupRole[] = ['student', 'teacher', 'parent']

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', phone: '+998 ', login: '', password: '', role: 'student' as SignupRole, child: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    const login = f.login.trim().toLowerCase()
    if (!LOGIN_RE.test(login)) return setErr("Login 3–30 belgi: lotin harflari, raqam, _ yoki . bo'lsin")
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password: f.password })
        if (error) throw error
      } else {
        if (f.name.trim().split(/\s+/).length < 2) throw new Error('Ism va familiyani to\'liq yozing')
        if (f.phone.replace(/\D/g, '').length < 12) throw new Error("Telefon raqamni to'liq yozing: +998 XX XXX XX XX")
        const child = f.child.trim().toLowerCase()
        if (f.role === 'parent' && !LOGIN_RE.test(child)) throw new Error("Farzandingiz loginini to'g'ri yozing")
        const { data: free } = await supabase.rpc('login_available', { p_login: login })
        if (free === false) throw new Error('Bu login band, boshqasini tanlang')
        const { error } = await supabase.auth.signUp({
          email: loginToEmail(login), password: f.password,
          options: { data: { full_name: f.name.trim(), phone: f.phone.trim(), login, requested_role: f.role, ...(f.role === 'parent' ? { child_login: child } : {}) } },
        })
        if (error) throw error
      }
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  const tab = (m: 'in' | 'up', label: string) => (
    <button type="button" onClick={() => { setMode(m); setErr(null) }}
      className={`h-11 cursor-pointer rounded-[9px] border-0 text-[15px] ${mode === m ? 'bg-white font-semibold text-ink shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
  )

  return (
    <div className="min-h-dvh lg:flex">
      <section className="hidden w-[42%] flex-col gap-9 bg-ink p-16 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" width={48} height={48} />
          <span className="font-display text-2xl font-bold">Huquqologiya</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-6">
          <h1 className="m-0 font-display text-5xl leading-tight">Milliy sertifikat va OTMga tayyorgarlik</h1>
          <p className="m-0 text-lg leading-relaxed text-slate-300">Jonli darslar, vazifalar, baholar va davomat bitta kabinetda. Telefonda ham, kompyuterda ham ishlaydi.</p>
        </div>
        <div className="text-sm text-slate-300">Savollar: Telegram @huquqologiya_admin · +998 93 977 88 00</div>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" width={60} height={60} />
            <div className="font-display text-3xl font-bold">Huquqologiya</div>
            <div className="text-sm text-muted">Onlayn maktab</div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-line p-1">{tab('in', 'Kirish')}{tab('up', "Ro'yxatdan o'tish")}</div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'up' && (
              <>
                <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                  <legend className="mb-1.5 p-0 text-sm font-medium">Siz kimsiz?</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {SIGNUP_ROLES.map((r) => (
                      <button key={r} type="button" aria-pressed={f.role === r} onClick={() => setF({ ...f, role: r })}
                        className={`h-11 cursor-pointer rounded-xl text-sm ${f.role === r ? 'border-0 bg-brand font-semibold text-white' : 'border border-field bg-white text-ink'}`}>{ROLE_LABEL[r]}</button>
                    ))}
                  </div>
                </fieldset>
                <label className="label">Ism va familiya<input className="input" required value={f.name} onChange={set('name')} placeholder="Aziza Karimova" autoComplete="name" /></label>
                <label className="label">Telefon raqam<input className="input" required type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
                {f.role === 'parent' && (
                  <label className="label">Farzandingiz logini<input className="input" required value={f.child} onChange={set('child')} placeholder="farzandingiz ro'yxatdan o'tgan login" autoCapitalize="none" /></label>
                )}
              </>
            )}
            <label className="label">Login<input className="input" required value={f.login} onChange={set('login')} placeholder="masalan, aziza_08" autoCapitalize="none" autoComplete="username" /></label>
            <label className="label">Parol<input className="input" required type="password" minLength={6} value={f.password} onChange={set('password')} placeholder={mode === 'up' ? 'kamida 6 belgi' : ''} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>
            {err && <ErrorBox text={err} />}
            <button className="btn-primary mt-1 h-13 text-base" disabled={busy}>{busy ? 'Kuting…' : mode === 'in' ? 'Kirish' : "Ro'yxatdan o'tish"}</button>
            <p className="m-0 text-center text-sm text-muted">
              {mode === 'in' ? "Parolni unutdingizmi? Telegram: @huquqologiya_admin" : 'Arizangizni o‘qituvchi tasdiqlagach, kabinet ochiladi'}
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
