import { supabase } from './supabase'
import { must } from './useQuery'
import type { Group, Profile, Subject } from './types'

export const getSubjects = () => must<Subject[]>(supabase.from('subjects').select('*').order('name'))

export const getGroups = () =>
  must<Group[]>(supabase.from('groups').select('*, subjects(*)').order('name'))

export const getProfiles = (filter?: { status?: string; role?: string }) => {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (filter?.status) q = q.eq('status', filter.status)
  if (filter?.role) q = q.eq('role', filter.role)
  return must<Profile[]>(q)
}

// O'quvchining (yoki o'qituvchining) guruhlari
export async function myGroups(p: Profile): Promise<Group[]> {
  if (p.role === 'admin') return getGroups()
  if (p.role === 'teacher') return must<Group[]>(supabase.from('groups').select('*, subjects(*)').eq('teacher_id', p.id).order('name'))
  const rows = await must<{ groups: Group }[]>(supabase.from('enrollments').select('groups(*, subjects(*))').eq('student_id', p.id))
  return rows.map((r) => r.groups).filter(Boolean)
}

export const groupLabel = (g: Group) => `${g.subjects?.name ?? ''} · ${g.name}`

// Fayl yuklash / ochish (Storage 'maktab')
export async function uploadFile(path: string, file: File) {
  const { error } = await supabase.storage.from('maktab').upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw new Error(error.message)
  return path
}
export async function fileUrl(path: string) {
  const { data, error } = await supabase.storage.from('maktab').createSignedUrl(path, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
export const safeName = (n: string) => `${Date.now()}_${n.replace(/[^\w.\-]+/g, '_')}`

export const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
