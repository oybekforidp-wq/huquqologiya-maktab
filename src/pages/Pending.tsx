import { useAuth } from '../lib/auth'
import { Icon } from '../components/Icon'

export default function Pending() {
  const { profile, refresh, signOut } = useAuth()
  const rejected = profile?.status === 'rejected'
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className={`flex h-24 w-24 items-center justify-center self-center rounded-full ${rejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
        <Icon name="clock" size={44} />
      </div>
      <div className="text-center">
        <h1 className="m-0 font-display text-2xl">{rejected ? 'Arizangiz rad etildi' : 'Arizangiz qabul qilindi'}</h1>
        <p className="mt-2 leading-relaxed text-muted">
          {rejected ? "Savollar bo'lsa, admin bilan bog'laning." : "O'qituvchi tasdiqlagach, kabinetingiz ochiladi. Bu odatda bir kun ichida bo'ladi."}
        </p>
      </div>
      {!rejected && (
        <ol className="card m-0 flex list-none flex-col gap-3.5 p-5">
          <li className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">✓</span>Ro'yxatdan o'tdingiz</li>
          <li className="flex items-center gap-3 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 text-sm font-bold text-white">2</span>O'qituvchi tasdiqlashi</li>
          <li className="flex items-center gap-3 text-muted"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-sm font-bold">3</span>Guruhga qo'shilasiz, darslar boshlanadi</li>
        </ol>
      )}
      <div className="text-center text-sm text-muted">Telegram: @huquqologiya_admin</div>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={signOut}>Chiqish</button>
        <button className="btn-primary" onClick={refresh}>Tekshirish</button>
      </div>
    </div>
  )
}
