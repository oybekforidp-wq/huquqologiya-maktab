const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()}-${months[d.getMonth()]}`
}
export function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function fmtDateTime(iso: string | null | undefined) {
  return iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : ''
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')
}
export function errText(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/Invalid login credentials/i.test(m)) return "Login yoki parol noto'g'ri"
  if (/already registered/i.test(m)) return 'Bu login band'
  if (/Password should be/i.test(m)) return "Parol kamida 6 belgidan iborat bo'lsin"
  return m
}
