import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

// Supabase email talab qiladi: login'dan ichki email yasaymiz (foydalanuvchi uni ko'rmaydi)
export const loginToEmail = (login: string) => `${login.trim().toLowerCase()}@users.huquqologiya.uz`

export const LOGIN_RE = /^[a-z0-9_.]{3,30}$/
