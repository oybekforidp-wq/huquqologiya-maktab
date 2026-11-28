import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from './ui'
import { RatingModal, type PendingRating } from './RatingGate'
import { useAuth } from '../lib/auth'
import { initials } from '../lib/format'
import { Icon } from './Icon'

type Item = { to: string; label: string; icon: string; end?: boolean }

const STUDENT: Item[] = [
  { to: '/', label: 'Bosh sahifa', icon: 'home', end: true },
  { to: '/darslar', label: 'Darslar', icon: 'lessons' },
  { to: '/vazifalar', label: 'Vazifalar', icon: 'tasks' },
  { to: '/baholar', label: 'Baholarim', icon: 'grades' },
  { to: '/yordamchi', label: 'AI yordamchi', icon: 'chat' },
]
const STAFF: Item[] = [
  { to: '/', label: 'Bosh sahifa', icon: 'home', end: true },
  { to: '/darslar', label: 'Darslar', icon: 'lessons' },
  { to: '/vazifalar', label: 'Vazifalar', icon: 'tasks' },
  { to: '/jurnal', label: 'Jurnal', icon: 'journal' },
  { to: '/yordamchi', label: 'AI yordamchi', icon: 'chat' },
]
const PARENT: Item[] = [
  { to: '/', label: 'Farzandlarim', icon: 'users', end: true },
  { to: '/fikr', label: 'Fikr va baho', icon: 'grades' },
  { to: '/yordamchi', label: 'AI yordamchi', icon: 'chat' },
]
const ADMIN: Item[] = [
  { to: '/admin/arizalar', label: 'Arizalar', icon: 'inbox' },
  { to: '/admin/fanlar', label: 'Fanlar va guruhlar', icon: 'book' },
  { to: '/admin/kurs', label: 'Kurs shabloni', icon: 'book' },
  { to: '/admin/qonunlar', label: 'Qonunlar bazasi', icon: 'scale' },
  { to: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: 'users' },
  { to: '/admin/reyting', label: "Ustoz reytingi", icon: 'grades' },
]

const roleLabel = { student: "O'quvchi", teacher: "O'qituvchi", admin: 'Admin', parent: 'Ota-ona' }

export function Layout() {
  const { profile, signOut } = useAuth()
  const loc = useLocation()
  const isStudent = profile?.role === 'student'
  // O'quvchi: tugagan darsni baholamaguncha ilovadan foydalana olmaydi
  const [pending, setPending] = useState<PendingRating | null>(null)
  const [checked, setChecked] = useState(!isStudent)
  const check = useCallback(async () => {
    if (!isStudent) return
    const { data } = await supabase.rpc('pending_rating')
    setPending(((data as PendingRating[] | null) ?? [])[0] ?? null)
    setChecked(true)
  }, [isStudent])
  useEffect(() => { check() }, [check, loc.pathname])
  useEffect(() => {
    if (!isStudent) return
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [isStudent, check])

  if (!profile) return null
  const main = profile.role === 'parent' ? PARENT : profile.role === 'student' ? STUDENT : STAFF
  const extra = profile.role === 'admin' ? ADMIN : []

  const link = (it: Item) => (
    <NavLink key={it.to} to={it.to} end={it.end}
      className={({ isActive }) => `flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline ${isActive ? 'bg-brand-soft font-semibold text-brand-dark' : 'text-slate-700 hover:bg-bg'}`}>
      <Icon name={it.icon} />{it.label}
    </NavLink>
  )

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-line bg-white p-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
          <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={34} height={34} />
          <span className="font-display text-xl font-bold">Huquqologiya</span>
        </div>
        {main.map(link)}
        {extra.length > 0 && <div className="px-3 pb-1 pt-4 text-xs font-bold tracking-wide text-muted">BOSHQARUV</div>}
        {extra.map(link)}
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 border-t border-line px-2 pt-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{initials(profile.full_name)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{profile.full_name}</div>
            <div className="text-xs text-muted">{roleLabel[profile.role]}</div>
          </div>
          <button onClick={signOut} aria-label="Chiqish" title="Chiqish" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:bg-bg">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-white px-4 md:hidden">
        <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={28} height={28} />
        <span className="flex-1 font-display text-lg font-bold">Huquqologiya</span>
        {extra.length > 0 && (
          <NavLink to="/admin/arizalar" className="rounded-lg px-2 py-1 text-sm font-semibold text-brand no-underline">Admin</NavLink>
        )}
        <button onClick={signOut} aria-label="Chiqish" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted">
          <Icon name="logout" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
        {!checked ? <Spinner /> : pending ? null : <Outlet />}
      </main>
      {pending && <RatingModal p={pending} onDone={check} />}

      <nav className="fixed inset-x-0 bottom-0 z-10 grid h-[68px] border-t border-line bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${main.length}, minmax(0, 1fr))` }}>
        {main.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-center text-xs leading-tight no-underline ${isActive ? 'font-semibold text-brand' : 'text-muted'}`}>
            <Icon name={it.icon} size={22} />{it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
