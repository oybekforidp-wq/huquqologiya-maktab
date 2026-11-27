import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export function Spinner({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-field border-t-brand" />{label}
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {text && <p className="m-0 max-w-md text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorBox({ text }: { text: string }) {
  return <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{text}</div>
}

export function PageHead({ title, sub, back, right }: { title: string; sub?: string; back?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {back && (
        <Link to={back} aria-label="Orqaga" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink">
          <Icon name="back" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="m-0 font-display text-2xl font-bold md:text-3xl">{title}</h1>
        {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

const tone = {
  blue: 'bg-brand-soft text-brand-dark', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800', gray: 'bg-slate-100 text-slate-700',
}
export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: keyof typeof tone }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone[color]}`}>{children}</span>
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  )
}
