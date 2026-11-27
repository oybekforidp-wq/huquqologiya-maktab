import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// ====== TAHRIRLASH UCHUN: ustoz ma'lumotlari ======
const TEACHER = {
  name: "Po'latjonov Oybek",
  role: "Huquqologiya o'quv kursi ustozi",
  initials: 'OP',
  photo: '' as string, // masalan: 'landing/ustoz.jpg' (public/ ichida). Bo'sh bo'lsa — bosh harflar chiqadi.
  bio: [
    "Imtihondan o'zi yuqori natija bilan o'tgan ustoz sizga ham shu yo'lni o'rgatadi: qaysi mavzularga e'tibor berish, murakkab testlarni qanday yechish va imtihonda vaqtni qanday taqsimlash.",
    "\"Huquqologiya\" qo'llanmalari (I, II, III qism) va \"Testlar to'plami\" muallifi.",
  ],
  cv: [
    ['DTM, 2021', "186,9 ball — Toshkent davlat yuridik universiteti, Yurisprudensiya (jinoyat-huquqiy faoliyat)"],
    ['Bakalavr, 2025', 'TDYU — Yurist'],
    ['Magistr, 2026', 'TDYU, Mehnat huquqi — Yurist'],
    ['Amaliyot', 'Sud va adliya tizimida amaliy tajriba'],
    ['Hozirda', "IIV akademik litsey huquqshunoslik fani o'qituvchisi"],
  ] as [string, string][],
  group: "Kechki guruh: 18:00–20:00, online darslar ham bor",
  docs: [['landing/diplom-bakalavr.jpg', 'Bakalavr diplomi · TDYU · 2025'], ['landing/diplom-magistr.jpg', 'Magistr diplomi · TDYU · 2026']] as [string, string][],
  facts: [['186,9', 'DTM bali'], ['3', "qo'llanma qismi"], ['2000+', 'test']] as [string, string][],
}
// ==================================================

const B = import.meta.env.BASE_URL + 'landing/'
const TG = 'https://t.me/huquqologiya_admin'
const PHONE = '+998 93 977 88 00'
const TEL = 'tel:+998939778800'
const CHANNEL = 'https://t.me/Huquqologiya_kurs'
const INSTA = 'https://instagram.com/huquqologiya_kurs'

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = ref.current?.querySelectorAll('.ld-rv') ?? []
    if (typeof IntersectionObserver === 'undefined') { els.forEach(e => e.classList.add('in')); return }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.12 })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [])
  return ref
}

const Rv = ({ children, d = 0, className = '' }: { children: ReactNode; d?: number; className?: string }) => (
  <div className={`ld-rv ${className}`} style={{ ['--d' as string]: `${d}s` }}>{children}</div>
)

const H2 = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="mb-8 text-center">
    <div className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d7262f]">{k}</div>
    <h2 className="m-0 font-display text-3xl font-bold md:text-4xl">{children}</h2>
  </div>
)

const STEPS: [string, string][] = [
  ["Ro'yxatdan o'ting", "Sayt orqali login va parol bilan ariza qoldiring."],
  ['Admin tasdiqlaydi', "Arizangiz ko'rib chiqilib, kabinetingiz faollashtiriladi."],
  ['1-dars tekin', "Birinchi darsda qatnashib, ustoz va uslubni sinab ko'rasiz."],
  ["Oylik to'lov", "Yoqsa — oylik to'lov qilib, kursni davom ettirasiz."],
  ['Jonli darslar', "Zoom/Meet va interaktiv doskada darslar, yozuvlar kabinetda."],
]
const FEATS: [string, string][] = [
  ['📝', 'Uyga vazifa va testlar'], ['⚖️', 'Kazuslar tahlili'], ['📊', 'Baholar va davomat'], ['👨‍👩‍👧', 'Ota-ona monitoringi'],
]
const COVERS = [
  { src: 'muqova-1.jpg', ry: '22deg', x: -1.5, z: '0px', ad: '0s' },
  { src: 'muqova-2.jpg', ry: '12deg', x: -0.5, z: '40px', ad: '.6s' },
  { src: 'muqova-3.jpg', ry: '-12deg', x: 0.5, z: '40px', ad: '1.2s' },
  { src: 'muqova-test.jpg', ry: '-22deg', x: 1.5, z: '0px', ad: '1.8s' },
]

function Fan() {
  return (
    <div className="ld-stage">
      <div className="ld-fan" aria-hidden>
        {COVERS.map(c => (
          <div key={c.src} className="ld-book" style={{ ['--ry' as string]: c.ry, ['--i' as string]: c.x, ['--z' as string]: c.z, ['--ad' as string]: c.ad }}>
            <img src={B + c.src} alt="" loading="eager" />
          </div>
        ))}
      </div>
    </div>
  )
}

const btnBase = 'inline-flex h-12 items-center justify-center rounded-xl px-6 font-semibold transition hover:-translate-y-0.5'

export default function Landing() {
  const root = useReveal()
  return (
    <div ref={root} className="ld min-h-dvh bg-white">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="#" className="flex items-center gap-2 font-display text-xl font-bold text-white no-underline">
            <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width={32} height={32} />Huquqologiya
          </a>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#kitoblar" className="hidden px-3 text-white/80 no-underline hover:text-white sm:inline">Kitoblar</a>
            <a href="#kontakt" className="hidden px-3 text-white/80 no-underline hover:text-white sm:inline">Kontaktlar</a>
            <Link to="/kirish" className="rounded-lg border border-white/40 px-4 py-2 font-semibold text-white no-underline hover:bg-white/10">Kirish</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="ld-hero relative overflow-hidden px-4 pb-16 pt-24 text-white md:pb-24 md:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
          <div className="text-center md:text-left">
            <div className="mb-4 inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">Onlayn maktab · Huquqshunoslik</div>
            <h1 className="m-0 font-display text-5xl font-bold leading-[1.05] md:text-6xl">
              <span className="text-[#ff4650]">Huquq</span>ologiya
            </h1>
            <p className="mx-auto mb-0 mt-4 max-w-md text-lg leading-relaxed text-slate-200 md:mx-0">
              <span className="ld-grad-text font-bold">Milliy sertifikat va OTMga</span> tayyorgarlik: jonli darslar, qo'llanma va testlar, baholar va davomat — bitta joyda.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <Link to="/kirish" className={`${btnBase} bg-[#d7262f] text-white no-underline shadow-lg shadow-red-900/40 hover:bg-[#bd1f28]`}>Ro'yxatdan o'tish</Link>
              <a href="#kitoblar" className={`${btnBase} border border-white/40 text-white no-underline hover:bg-white/10`}>Kitoblarni ko'rish</a>
            </div>
            <div className="mt-4 text-sm text-slate-300">1-dars — tekin. Kitob olish uchun ro'yxatdan o'tish shart emas.</div>
          </div>
          <div className="relative">
            <div className="ld-glow absolute inset-0" />
            <Fan />
          </div>
        </div>
      </section>

      {/* Ustoz */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <H2 k="Ustoz haqida">{TEACHER.name}</H2>
        <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <Rv className="mx-auto">
            <div className="ld-tilt relative" style={{ ['--ry' as string]: '-8deg' }}>
              {TEACHER.photo ? (
                <img src={import.meta.env.BASE_URL + TEACHER.photo} alt={TEACHER.name} className="h-56 w-56 rounded-3xl object-cover shadow-2xl" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-3xl bg-gradient-to-br from-[#13294b] to-[#2a5298] font-display text-7xl font-bold text-white shadow-2xl" aria-label={TEACHER.name}>{TEACHER.initials}</div>
              )}
              <div className="absolute -bottom-3 -right-3 rounded-xl bg-[#f39a2b] px-3 py-1.5 text-sm font-bold text-[#13294b] shadow-lg">Muallif</div>
            </div>
          </Rv>
          <Rv d={0.1}>
            <div className="mb-3 font-semibold text-[#d7262f]">{TEACHER.role}</div>
            {TEACHER.bio.map((p, i) => <p key={i} className="mb-3 mt-0 leading-relaxed text-slate-600">{p}</p>)}
            <ul className="mb-4 mt-1 flex list-none flex-col gap-2 p-0">
              {TEACHER.cv.map(([k, v]) => (
                <li key={k} className="flex gap-3 text-sm leading-snug"><span className="w-28 shrink-0 font-semibold text-[#13294b]">{k}</span><span className="text-slate-600">{v}</span></li>
              ))}
            </ul>
            <p className="mb-4 mt-0 rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-[#13294b]">🕕 {TEACHER.group}<br /><span className="font-normal">Ro'yxatdan o'tish: <a href={TEL}>{PHONE}</a> · <a href="https://t.me/Oybeck" target="_blank" rel="noreferrer">@Oybeck</a></span></p>
            <div className="mt-5 flex gap-3">
              {TEACHER.facts.map(([n, l]) => (
                <div key={l} className="flex-1 rounded-2xl border border-line bg-bg p-3 text-center">
                  <div className="font-display text-2xl font-bold text-[#13294b]">{n}</div>
                  <div className="text-xs text-muted">{l}</div>
                </div>
              ))}
            </div>
          </Rv>
        </div>
        <Rv>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {TEACHER.docs.map(([src, cap]) => (
              <figure key={src} className="m-0 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
                <img src={import.meta.env.BASE_URL + src} alt={cap} loading="lazy" className="block h-auto w-full" />
                <figcaption className="px-4 py-2 text-center text-sm text-muted">{cap}</figcaption>
              </figure>
            ))}
          </div>
        </Rv>
      </section>

      {/* Kurs */}
      <section className="bg-bg px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <H2 k="Kurs">Kurs qanday o'tadi</H2>
          <div className="grid gap-4 md:grid-cols-5">
            {STEPS.map(([t, d], i) => (
              <Rv key={t} d={i * 0.08}>
                <div className="ld-card3d relative h-full rounded-2xl border border-line bg-white p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#13294b] font-display font-bold text-white">{i + 1}</div>
                  <div className="mb-1 font-bold">{t}</div>
                  <div className="text-sm leading-relaxed text-muted">{d}</div>
                </div>
              </Rv>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {FEATS.map(([e, t], i) => (
              <Rv key={t} d={i * 0.06}>
                <div className="ld-card3d flex items-center gap-3 rounded-2xl border border-line bg-white p-4 font-semibold">
                  <span className="text-2xl" aria-hidden>{e}</span><span className="text-sm">{t}</span>
                </div>
              </Rv>
            ))}
          </div>
          <Rv>
            <div className="mt-6 rounded-2xl bg-[#13294b] p-5 text-center text-white md:p-6">
              <div className="font-display text-xl font-bold">6 oylik dastur</div>
              <div className="mt-1 text-slate-200">Taxminan 5 oy — yangi mavzular bo'yicha darslar, oxirgi 1 oy — to'liq takrorlash va imtihonga tayyorlov.</div>
              <div className="mx-auto mt-4 flex max-w-md overflow-hidden rounded-full text-xs font-semibold">
                <div className="flex-[5] bg-[#d7262f] py-1.5">5 oy · darslar</div>
                <div className="flex-1 bg-[#f39a2b] py-1.5 text-[#13294b]">1 oy · takror</div>
              </div>
            </div>
          </Rv>
        </div>
      </section>

      {/* Kitoblar */}
      <section id="kitoblar" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16">
        <H2 k="Kitoblar">Huquqologiya kitoblar to'plami</H2>
        <Rv>
          <img src={B + 'kitoblar-4.jpg'} alt="Huquqologiya: qo'llanma I, II, III qism va Testlar to'plami" loading="lazy" width={1200} height={1200}
            className="mx-auto mb-8 w-full max-w-xl rounded-3xl shadow-2xl" />
        </Rv>
        <div className="grid gap-4 md:grid-cols-2">
          <Rv>
            <div className="ld-card3d h-full rounded-2xl border border-line p-5">
              <h3 className="m-0 mb-2 font-display text-xl font-bold">Qo'llanma (I, II, III qism)</h3>
              <p className="mb-3 mt-0 text-sm text-muted">Har bir modda shunday tuzilgan:</p>
              <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {[['Darslikda', "8–11-sinf darsliklaridagi o'rni (dars va bet raqami bilan)"], ['Qonunda aslida', 'qonun matni, muhim so\'zlar belgilangan'], ['Izoh', 'oddiy tilda qisqa tushuntirish'], ['Adashtirma', "imtihonda uchraydigan tuzoqlar"]].map(([a, b], i) => (
                  <li key={a} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d7262f] text-xs font-bold text-white">{i + 1}</span><span><b>{a}</b> — {b}</span></li>
                ))}
              </ol>
            </div>
          </Rv>
          <Rv d={0.1}>
            <div className="ld-card3d h-full rounded-2xl border border-line p-5">
              <h3 className="m-0 mb-2 font-display text-xl font-bold">Testlar to'plami</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {["~2000 ta test, 40 ta qonun bo'yicha", "DTM / Milliy sertifikat darajasida", "Yangi o'zgartirish va qo'shimchalar hisobga olingan", "Har qonun bo'yicha testlar va javoblar kaliti", "Yozma ochiq savollar", "Kazuslar"].map(x => (
                  <li key={x} className="flex gap-2"><span className="text-[#f39a2b]">●</span>{x}</li>
                ))}
              </ul>
            </div>
          </Rv>
        </div>

        <div className="mt-10 text-center">
          <div className="mb-4 font-display text-lg font-bold">Kitob ichidan</div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 md:gap-6">
            {[['ichidan-qollanma.jpg', "Qo'llanmadan namuna", '-6deg'], ['ichidan-test.jpg', "Testlar to'plamidan namuna", '6deg']].map(([s, a, ry]) => (
              <Rv key={s}>
                <div className="ld-tilt" style={{ ['--ry' as string]: ry }}>
                  <img src={B + s} alt={a} loading="lazy" className="w-full rounded-lg border border-line bg-white shadow-xl" />
                </div>
              </Rv>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Rv>
            <div className="relative h-full overflow-hidden rounded-2xl bg-[#13294b] p-6 text-white">
              <div className="text-sm text-slate-300">1 ta kitob</div>
              <div className="font-display text-3xl font-bold">49 000 <span className="text-lg">so'm</span></div>
              <div className="mt-4 text-sm text-slate-300">4 ta kitob to'plami</div>
              <div className="font-display text-4xl font-bold ld-grad-text">149 000 <span className="text-lg">so'm</span></div>
              <div className="mt-1 text-xs text-slate-300">To'plam bilan 47 000 so'm tejaysiz</div>
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm">BTS pochta orqali barcha viloyatlarga yetkazib beriladi. Yetkazish ~30 000 so'm (hududga qarab).</div>
            </div>
          </Rv>
          <Rv d={0.1}>
            <div className="h-full rounded-2xl border-2 border-[#f39a2b] p-6">
              <h3 className="m-0 mb-3 font-display text-xl font-bold">Qanday xarid qilinadi</h3>
              <p className="mb-3 mt-0 text-sm text-muted">Ro'yxatdan o'tish shart emas.</p>
              <ol className="m-0 mb-5 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                <li>Telegramda <b>@huquqologiya_admin</b>ga yozing yoki qo'ng'iroq qiling</li>
                <li>Kartaga to'lov qiling</li>
                <li>Kitoblar pochta orqali yuboriladi</li>
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a href={TG} target="_blank" rel="noreferrer" className={`${btnBase} flex-1 bg-[#d7262f] text-white no-underline hover:bg-[#bd1f28]`}>Telegramda yozish</a>
                <a href={TEL} className={`${btnBase} flex-1 border border-[#13294b] text-[#13294b] no-underline hover:bg-bg`}>{PHONE}</a>
              </div>
            </div>
          </Rv>
        </div>
      </section>

      {/* Kontakt */}
      <section id="kontakt" className="ld-hero scroll-mt-4 px-4 py-14 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="m-0 mb-6 font-display text-3xl font-bold">Kontaktlar</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['Telegram (admin)', '@huquqologiya_admin', TG], ['Telefon', PHONE, TEL], ['Telegram kanal', '@Huquqologiya_kurs', CHANNEL], ['Instagram', '@huquqologiya_kurs', INSTA]].map(([l, v, h]) => (
              <a key={l} href={h} target={h.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="ld-card3d block rounded-2xl border border-white/20 bg-white/10 p-4 text-white no-underline">
                <div className="text-xs uppercase tracking-wide text-slate-300">{l}</div>
                <div className="mt-1 font-semibold">{v}</div>
              </a>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/kirish" className={`${btnBase} bg-[#d7262f] text-white no-underline`}>Ro'yxatdan o'tish</Link>
            <Link to="/kirish" className={`${btnBase} border border-white/40 text-white no-underline`}>Kirish</Link>
          </div>
        </div>
      </section>
      <footer className="bg-[#0d1d38] px-4 py-6 text-center text-sm text-slate-400">© {new Date().getFullYear()} Huquqologiya · Onlayn maktab</footer>
    </div>
  )
}
