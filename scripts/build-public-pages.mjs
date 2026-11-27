import { mkdir, readFile, writeFile } from 'node:fs/promises'

const origin = 'https://huquqologiya.uz'
const pages = [
  {
    slug: 'milliy-sertifikat',
    title: 'Huquqdan milliy sertifikatga tayyorgarlik',
    description: 'Huquqologiya onlayn kursida huquq fanidan milliy sertifikat va OTMga tayyorlaning. Birinchi dars bepul.',
    body: `<p>Po‘latjonov Oybek bilan huquq fanidan onlayn darslarda qatnashing. Birinchi dars bepul.</p>
    <h2>Kurs yo‘nalishlari</h2>
    <p>Konstitutsiyaviy, jinoyat, fuqarolik, oila, mehnat va ma’muriy huquq mavzularini o‘rganasiz. O‘rganganlaringizni testlar va kazuslar orqali mustahkamlaysiz.</p>
    <h2>Tayyorgarlikni qanday boshlash mumkin?</h2>
    <ol><li><a href="/huquq-testlari/">Ochiq namunaviy testlarni</a> yechib, qaysi ko‘nikmalar ustida ishlashni aniqlang.</li>
    <li>Xatolarni mavzularga ajrating va har bir javobni tegishli manba bilan tekshiring.</li>
    <li><a href="/kirish">Ro‘yxatdan o‘tib</a>, birinchi darsni oching.</li></ol>`,
  },
  {
    slug: 'huquq-testlari',
    title: 'Huquq fanidan bepul namunaviy testlar',
    description: 'Huquqiy matnni o‘qish va kazus tahlili bo‘yicha ochiq mashqlar. Har bir testda javob va izoh bor.',
    body: `<p>Variantni tanlang, keyin javob va izohni oching. Savollar huquqiy matn bilan ishlash ko‘nikmasini mashq qildiradi.</p>
    <h2>1. Qonun matnini o‘qish</h2>
    <p>Bir hujjatning ikki xil matnini topdingiz. Amaldagi tahrirni qayerdan tekshirasiz?</p>
    <ol type="A"><li>Eski konspektdan</li><li><a href="https://lex.uz/">LexUZ</a>dagi hujjat sahifasidan</li><li>Izohlardagi skrinshotdan</li><li>Qidiruv natijasi sarlavhasidan</li></ol>
    <details><summary>Javob va izoh</summary><p><strong>B.</strong> Rasmiy manbada hujjatni topib, o‘rganayotgan holat sanasi uchun tegishli tahrirni tekshiring.</p></details>
    <h2>2. Kazus tahlili</h2>
    <p>Shartda voqea sanasi berilgan. Masalani tahlil qilishda shu sana nima uchun kerak?</p>
    <ol type="A"><li>Javob hajmini aniqlash uchun</li><li>Manba nomini qisqartirish uchun</li><li>Qaysi tahrirni o‘rganish kerakligini aniqlash uchun</li><li>Variantlar tartibini eslab qolish uchun</li></ol>
    <details><summary>Javob va izoh</summary><p><strong>C.</strong> Voqea sanasi tahrirlarni solishtirish uchun boshlang‘ich ma’lumot beradi. Keyin normaning vaqt bo‘yicha qo‘llanish qoidalarini tekshirasiz.</p></details>
    <h2>3. Shart va istisno</h2>
    <p>Mashq uchun berilgan matn: “Ariza elektron yuboriladi. Texnik uzilish bo‘lsa, qog‘oz shakli ham qabul qilinadi.” Qog‘oz shakli qaysi holatda ko‘rsatilgan?</p>
    <ol type="A"><li>Har doim</li><li>Texnik uzilish bo‘lsa</li><li>Faqat dam olish kuni</li><li>Faqat arizachi so‘rasa</li></ol>
    <details><summary>Javob va izoh</summary><p><strong>B.</strong> Ikkinchi jumla qog‘oz shakli uchun shartni belgilaydi.</p></details>`,
  },
  {
    slug: 'kitoblar',
    title: 'Huquqologiya kitoblari va testlar to‘plami',
    description: 'Huquqologiya qo‘llanmasining I, II va III qismlari hamda testlar kitobi. Narxlar va buyurtma ma’lumotlari.',
    body: `<p>To‘plam uchta qo‘llanma va bitta test kitobidan iborat. Qo‘llanmalarda darslikdagi mavzu, qonun matni, izoh va imtihonda adashtirishi mumkin bo‘lgan jihatlar birga berilgan. Test kitobida 40 ta qonunchilik hujjati bo‘yicha mashqlar, javoblar kaliti va kazuslar bor.</p>
    <img src="/landing/kitoblar-4.jpg" alt="Huquqologiya qo‘llanmalari va test kitobi" width="1200" height="1200" loading="lazy">
    <h2>Narx va buyurtma</h2>
    <ul><li>1 ta kitob — 49 000 so‘m</li><li>2 ta kitob — 89 000 so‘m</li><li>3 ta kitob — 129 000 so‘m</li><li>To‘liq 4 ta kitob — 149 000 so‘m</li></ul>
    <p>Kitoblar pochta orqali O‘zbekiston bo‘ylab yuboriladi. Yetkazish narxi hududga qarab belgilanadi.</p>
    <p><a href="https://t.me/huquqologiya_admin">Telegram orqali buyurtma berish</a></p>`,
  },
  {
    slug: 'maqolalar',
    title: 'Huquqiy maqolalar va dars izohlari',
    description: 'Huquqologiya maqolalari. Jinoyat tarkibini misollar orqali tahlil qilish va huquqiy matn bilan ishlash.',
    body: `<article><h2>Formal, moddiy va kesik tarkibli jinoyatlarni qanday ajratish mumkin?</h2>
    <p>Mavzuni o‘rganayotganda bitta savoldan boshlang: norma qilmishni qaysi paytdan boshlab tamom bo‘lgan deb baholaydi?</p>
    <ul><li><strong>Moddiy tarkib.</strong> Dispozitsiyada ko‘rsatilgan oqibat va uning qilmish bilan sababiy bog‘lanishini tekshiring.</li>
    <li><strong>Formal tarkib.</strong> Dispozitsiyadagi qilmish bajarilgan paytga e’tibor bering. Tamom bo‘lish uchun alohida oqibat talab qilinmaydi.</li>
    <li><strong>Kesik tarkib.</strong> Tamom bo‘lish payti ko‘zlangan natijaga nisbatan oldinroqqa ko‘chiriladi. Norma qaysi harakatni chegaraviy payt sifatida olganini aniqlang.</li></ul>
    <p><strong>Mashq.</strong> Shartli normada zarar kelib chiqishi aniq talab qilinsa, qilmish sodir etilgan sana bilan zararning yuz bergan sanasini ajrating. Keyin qilmish bilan oqibat o‘rtasidagi bog‘lanishni izohlang.</p>
    <p>Qo‘shimcha o‘qish: <a href="https://library.tsul.uz/uz/books/4009">TDYU kutubxonasi — Jinoyat huquqi (Umumiy qism)</a>.</p></article>`,
  },
]

const links = pages.map(({ slug, title }) => `<a href="/${slug}/">${title}</a>`).join('')
const styles = `*{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#142442;font:1rem/1.65 system-ui,sans-serif}header{background:#0f1b2d;color:white}header div,main,footer{max-width:48rem;margin:auto;padding:1rem 1.25rem}header div{display:flex;justify-content:space-between;align-items:center}header a{color:white}main{padding-block:2rem 3rem}h1,h2{line-height:1.2}h1{font-size:clamp(2rem,5vw,3rem)}h2{margin-top:2rem}a{color:#8d1722;text-underline-offset:.2em}img{max-width:100%;height:auto;border-radius:1rem}details{background:white;border:1px solid #dbe2ef;border-radius:.7rem;padding:.75rem 1rem}summary{cursor:pointer;font-weight:600}footer nav{display:flex;flex-wrap:wrap;gap:.6rem 1rem}`

for (const { slug, title, description, body } of pages) {
  const folder = `dist/${slug}`
  await mkdir(folder, { recursive: true })
  await writeFile(`${folder}/index.html`, `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Huquqologiya</title><meta name="description" content="${description}">
<link rel="canonical" href="${origin}/${slug}/"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>${styles}</style></head><body><header><div><a href="/">Huquqologiya</a><a href="/kirish">Kirish</a></div></header>
<main><h1>${title}</h1>${body}</main><footer><nav aria-label="Ochiq materiallar">${links}</nav></footer></body></html>
`)
}

const main = await readFile('dist/index.html', 'utf8')
await writeFile('dist/404.html', main.replace(
  /<link rel="canonical"[^>]+>/,
  '<meta name="robots" content="noindex">',
))

await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
const urls = ['', ...pages.map(({ slug }) => `${slug}/`)]
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>${origin}/${path}</loc></url>`).join('\n')}\n</urlset>\n`)
