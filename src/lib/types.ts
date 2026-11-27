export type Role = 'student' | 'teacher' | 'admin' | 'parent'
export type Status = 'pending' | 'active' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  phone: string
  login: string
  role: Role
  status: Status
  child_login?: string | null
  created_at: string
}

export interface Subject { id: string; name: string; description: string | null }
export interface Group { id: string; subject_id: string; name: string; teacher_id: string | null; subjects?: Subject }

export interface Lesson {
  id: string; group_id: string; title: string; starts_at: string
  is_live: boolean; ended_at: string | null
}
export interface LessonLinks { meeting_url: string | null; recording_url: string | null }
export interface GroupAccess { free_lesson: string | null; paid_until: string | null; paid: boolean; staff: boolean }

export type AssignmentKind = 'test' | 'written' | 'file' | 'kazus'
export interface Question { q: string; o: string[]; c?: number; a?: string }
export interface Assignment {
  id: string; group_id: string; lesson_id: string | null; title: string; kind: AssignmentKind
  instructions: string | null; due_at: string | null; max_score: number; questions?: Question[]
}
export interface Submission {
  id: string; assignment_id: string; student_id: string; answers: Record<string, number>
  text_answer: string | null; file_paths: string[]; auto_score: number | null; score: number | null
  feedback: string | null; submitted_at: string; graded_at: string | null
}

export const KIND_LABEL: Record<AssignmentKind, string> = {
  test: 'Test', written: 'Yozma javob', file: 'Fayl / rasm', kazus: 'Kazus',
}

export const ROLE_LABEL: Record<Role, string> = { student: "O'quvchi", teacher: 'Ustoz', parent: 'Ota-ona', admin: 'Admin' }

export interface ChildReport {
  student: { id: string; full_name: string; login: string }
  groups: { id: string; name: string; subject: string; teacher_id: string | null; teacher_name: string | null; paid_until: string | null }[]
  lessons: { id: string; group_id: string; title: string; starts_at: string; ended_at: string | null; status: 'present' | 'late' | 'absent' | null }[]
  tasks: { id: string; group_id: string; title: string; kind: AssignmentKind; max_score: number; due_at: string | null; submitted_at: string | null; score: number | null; feedback: string | null; graded_at: string | null }[]
  grades: { id: string; group_id: string; value: number; note: string | null; created_at: string }[]
}
export interface RatingSummary {
  lesson_avg: number | null; lesson_count: number; parent_avg: number | null; parent_count: number
  comments: { stars: number; comment: string; created_at: string; source: 'student' | 'parent' }[]
}
