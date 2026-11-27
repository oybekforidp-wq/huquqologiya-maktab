import { useState } from 'react'
import type { Group } from '../lib/types'

// Bir nechta kurs bo'lsa, tepada tanlash tugmalari
export function useGroupSel(groups: Group[] | null) {
  const [sel, setSel] = useState<string | null>(() => { try { return localStorage.getItem('gid') } catch { return null } })
  const ok = groups?.find((g) => g.id === sel)
  const gid = ok ? sel : groups?.[0]?.id ?? null
  const pick = (id: string) => { setSel(id); try { localStorage.setItem('gid', id) } catch { /* */ } }
  return { gid, pick, group: groups?.find((g) => g.id === gid) ?? null }
}

export function GroupTabs({ groups, gid, pick }: { groups: Group[]; gid: string | null; pick: (id: string) => void }) {
  if (groups.length < 2) return null
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Kurslar">
      {groups.map((g) => (
        <button key={g.id} role="tab" aria-selected={g.id === gid} onClick={() => pick(g.id)}
          className={`h-10 cursor-pointer rounded-full px-4 text-sm ${g.id === gid ? 'border-0 bg-brand font-semibold text-white' : 'border border-field bg-white text-ink'}`}>
          {g.subjects?.name} · {g.name}
        </button>
      ))}
    </div>
  )
}
