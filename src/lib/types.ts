export type Role = 'student' | 'teacher' | 'admin'
export type Status = 'pending' | 'active' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  phone: string
  login: string
  role: Role
  status: Status
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
