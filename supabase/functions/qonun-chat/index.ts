// Qonunchilik AI yordamchisi: kurs doirasidagi qonun matnlaridan qidiradi va Google Gemini orqali javob beradi.
// Supabase Dashboard → Edge Functions → nomi: qonun-chat. Secret: GEMINI_API_KEY (Google AI Studio).
import { createClient } from 'npm:@supabase/supabase-js@2'

// Kalit nomi boshqacha yozilgan bo'lsa ham topiladi (Google kalitlari "AIza" bilan boshlanadi)
const KEY = Deno.env.get('GEMINI_API_KEY') ||
  Object.entries(Deno.env.toObject()).find(([k, v]) => /gemini/i.test(k) && v.trim().startsWith('AIza'))?.[1].trim() || ''
const MAIN = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'
const LITE = Deno.env.get('GEMINI_MODEL_LITE') ?? 'gemini-flash-lite-latest'
const FALLBACK: Record<string, string> = { 'gemini-flash-latest': 'gemini-2.5-flash', 'gemini-flash-lite-latest': 'gemini-2.5-flash-lite' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Turn = { role: 'user' | 'model'; text: string }
type Hit = { law_key: string; law_name: string; url: string; art: string; title: string; body: string; rank: number }

class GeminiError extends Error { constructor(public status: number, msg: string) { super(msg) } }

async function gemini(model: string, body: unknown): Promise<string> {
  const call = (m: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
  })
  let r = await call(model)
  if (r.status === 404 && FALLBACK[model]) r = await call(FALLBACK[model])
  if (!r.ok) throw new GeminiError(r.status, (await r.text()).slice(0, 300))
  const d = await r.json()
  return (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
}

const PLAN_PROMPT = (laws: string) => `Sen huquq bo'yicha savollarni tahlil qiluvchi yordamchisan. Faqat JSON qaytar.
Kurs doirasidagi hujjatlar (key: nomi):
${laws}

Vazifa: foydalanuvchi savolini tahlil qil.
- in_scope: savol O'zbekiston qonunchiligi / huquq / davlat tuzilishi haqidami (true), yoki umuman boshqa mavzumi (false). Salomlashish ham false.
- laws: savolga eng mos 1-3 ta hujjat key'lari (yuqoridagi ro'yxatdan).
- article: agar savolda yoki aniq ma'lum bo'lsa, modda raqami (faqat raqam), aks holda "".
- keywords: qonun matnida uchraydigan rasmiy atamalar bilan 4-8 ta qidiruv so'zi, o'zbek lotin yozuvida (masalan "o'g'irlik" emas, "oʻgʻrilik"; "jinoiy javobgarlik yoshi").`

const ANSWER_PROMPT = `Sen "Huquqologiya" kursining huquqiy yordamchisisan. O'quvchilarga O'zbekiston qonunchiligi bo'yicha savollarga javob berasan.
QOIDALAR:
1. Faqat quyida berilgan qonun moddalariga tayan. O'zingdan fakt, raqam yoki modda o'ylab topma.
2. Har bir muhim fikrdan keyin manbani qavsda yoz: (Hujjat nomi, N-modda).
3. Agar berilgan moddalarda javob bo'lmasa, ochiq ayt: "Bu savolga kurs doirasidagi qonunlardan aniq javob topa olmadim" va savolni aniqroq berishni so'ra.
4. Javob o'zbek tilida (lotin yozuvi), qisqa va tushunarli: 3-8 gap yoki qisqa ro'yxat. Kerak bo'lsa modda matnidan qisqa iqtibos keltir.
5. Huquqdan tashqari mavzularga, shaxsiy maslahat yoki hujjat tayyorlashga javob berma.
6. Oddiy matn yoz, Markdown sarlavhalarisiz. Ro'yxat uchun "- " ishlat, qalin uchun **so'z**.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST kerak' }, 405)
  if (!KEY) return json({ error: "AI kaliti (GEMINI_API_KEY) hali qo'yilmagan" }, 500)

  const auth = req.headers.get('Authorization') ?? ''
  // Kalit: so'rovdagi apikey (sayt yuboradi) yoki muhitdagi anon/publishable kalit
  let pub = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!pub) { try { pub = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'))[0] as string } catch { /* yo'q */ } }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, pub, { global: { headers: { Authorization: auth } } })

  let question = '', history: Turn[] = []
  try {
    const b = await req.json()
    question = String(b.question ?? '').trim().slice(0, 700)
    history = (Array.isArray(b.history) ? b.history : []).slice(-6)
      .filter((t: Turn) => (t.role === 'user' || t.role === 'model') && typeof t.text === 'string')
      .map((t: Turn) => ({ role: t.role, text: t.text.slice(0, 1500) }))
  } catch { return json({ error: "Noto'g'ri so'rov" }, 400) }
  if (question.length < 3) return json({ error: 'Savol juda qisqa' }, 400)

  const q = await sb.rpc('ai_take_quota')
  if (q.error) return json({ error: "Kirish talab qilinadi (hisob tasdiqlangan bo'lishi kerak)" }, 401)
  const left = q.data as number
  if (left < 0) return json({ error: "Bugungi savollar limiti tugadi. Ertaga yana urinib ko'ring." }, 429)

  try {
    // 1) Savolni tahlil qilish: mavzu, qonunlar, qidiruv so'zlari
    const docs = await sb.from('law_docs').select('key, name')
    const lawList = (docs.data ?? []).map((d) => `${d.key}: ${d.name}`).join('\n')
    const prevUser = history.filter((t) => t.role === 'user').slice(-2).map((t) => t.text).join(' | ')
    const planText = await gemini(LITE, {
      systemInstruction: { parts: [{ text: PLAN_PROMPT(lawList) }] },
      contents: [{ role: 'user', parts: [{ text: (prevUser ? `Oldingi savollar: ${prevUser}\n` : '') + `Savol: ${question}` }] }],
      generationConfig: {
        temperature: 0, responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: {
          in_scope: { type: 'BOOLEAN' }, laws: { type: 'ARRAY', items: { type: 'STRING' } },
          article: { type: 'STRING' }, keywords: { type: 'STRING' } }, required: ['in_scope', 'laws', 'keywords'] },
      },
    })
    let plan: { in_scope?: boolean; laws?: string[]; article?: string; keywords?: string } = {}
    try { plan = JSON.parse(planText) } catch { plan = { in_scope: true, laws: [], keywords: '' } }
    if (plan.in_scope === false) {
      return json({ answer: "Men faqat O'zbekiston qonunchiligi bo'yicha (kurs doirasidagi qonunlar) savollarga javob beraman. Huquqqa oid savol bering, masalan: «Nikoh yoshi necha yosh?»", sources: [], left })
    }

    // 2) Qonun matnlaridan qidirish
    const s = await sb.rpc('law_search', {
      q: `${question} ${plan.keywords ?? ''}`.slice(0, 1000),
      p_laws: (plan.laws ?? []).slice(0, 3), p_art: String(plan.article ?? '').replace(/\D/g, '') || null, n: 8,
    })
    if (s.error) throw new Error(s.error.message)
    const hits = (s.data ?? []) as Hit[]
    if (!hits.length) {
      return json({ answer: "Bu savolga kurs doirasidagi qonunlardan mos modda topa olmadim. Savolni boshqacha yoki aniqroq yozib ko'ring (masalan, qaysi qonun haqida ekanini ayting).", sources: [], left })
    }
    const context = hits.map((h, i) => `[${i + 1}] ${h.law_name}, ${h.art}-modda${h.title ? '. ' + h.title : ''}\n${h.body.slice(0, 3500)}`).join('\n\n')

    // 3) Javob
    const answer = await gemini(MAIN, {
      systemInstruction: { parts: [{ text: ANSWER_PROMPT }] },
      contents: [
        ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        { role: 'user', parts: [{ text: `QONUN MODDALARI:\n${context}\n\nSAVOL: ${question}` }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    })

    // Javobda tilga olingan moddalarni manba sifatida qaytarish (bo'lmasa eng mos 3 tasi)
    const cited = hits.filter((h) => answer.includes(`${h.art}-modda`))
    const sources = (cited.length ? cited : hits.slice(0, 3)).slice(0, 5)
      .map((h) => ({ law: h.law_name, art: h.art, title: h.title, url: h.url }))
    return json({ answer: answer || "Javob olinmadi, qayta urinib ko'ring.", sources, left })
  } catch (e) {
    if (e instanceof GeminiError && e.status === 429) return json({ error: "AI hozir band (bepul limit). 1-2 daqiqadan keyin qayta urinib ko'ring." }, 503)
    console.error(e)
    return json({ error: 'AI xizmatida xatolik: ' + String((e as Error).message ?? e).slice(0, 200) }, 500)
  }
})
