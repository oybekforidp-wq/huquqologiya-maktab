import { useCallback, useEffect, useRef, useState } from 'react'
import { Excalidraw, convertToExcalidrawElements, exportToBlob, CaptureUpdateAction } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI, BinaryFileData, DataURL } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fileUrl, safeName, uploadFile } from '../lib/data'
import { Icon } from './Icon'
import { ErrorBox } from './ui'

declare global { interface Window { EXCALIDRAW_ASSET_PATH?: string } }
window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'

type Scene = { elements?: ExcalidrawElement[]; bg?: { w: number; h: number } }
interface Page { id: string; lesson_id: string; position: number; kind: 'blank' | 'image'; title: string | null; background_path: string | null; scene: Scene }

const fileIdOf = (path: string) => path.replace(/[^\w]/g, '_') as FileId
const blobToDataURL = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b) })

// Sahifa foni (PDF/slayd rasmi) — doskaga qulflangan rasm sifatida
function bgElements(p: Page): ExcalidrawElement[] {
  if (p.kind !== 'image' || !p.background_path) return []
  const { w, h } = p.scene.bg ?? { w: 1280, h: 720 }
  return convertToExcalidrawElements([{ type: 'image', x: 0, y: 0, width: w, height: h, fileId: fileIdOf(p.background_path), locked: true, status: 'saved', id: 'bg_' + p.id } as never])
}

export function Board({ lessonId, canEdit, live }: { lessonId: string; canEdit: boolean; live: boolean }) {
  const [pages, setPages] = useState<Page[]>([])
  const [cur, setCur] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [follow, setFollow] = useState(true)
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const chan = useRef<RealtimeChannel | null>(null)
  const loadedFiles = useRef(new Set<string>())
  const saveT = useRef<number | undefined>(undefined)
  const sendT = useRef(0)
  const lastSig = useRef('')
  const applying = useRef(false)
  const pagesRef = useRef<Page[]>([]); pagesRef.current = pages
  const curRef = useRef(0); curRef.current = cur
  const followRef = useRef(true); followRef.current = follow

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('board_pages').select('*').eq('lesson_id', lessonId).order('position')
    if (error) return setErr(error.message)
    let list = (data ?? []) as Page[]
    if (!list.length && canEdit) {
      const ins = await supabase.from('board_pages').insert({ lesson_id: lessonId, position: 0, kind: 'blank' }).select().single()
      if (ins.data) list = [ins.data as Page]
    }
    setPages(list)
  }, [lessonId, canEdit])
  useEffect(() => { load() }, [load])

  const ensureFile = async (p: Page) => {
    if (p.kind !== 'image' || !p.background_path || !api.current) return
    const id = fileIdOf(p.background_path)
    if (loadedFiles.current.has(id)) return
    const url = await fileUrl(p.background_path)
    const blob = await (await fetch(url)).blob()
    const dataURL = (await blobToDataURL(blob)) as DataURL
    api.current.addFiles([{ id, dataURL, mimeType: 'image/png', created: Date.now() } as BinaryFileData])
    loadedFiles.current.add(id)
  }

  // Sahifani doskaga chiqarish
  const show = useCallback(async (i: number, elements?: ExcalidrawElement[]) => {
    const p = pagesRef.current[i]
    if (!p || !api.current) return
    try { await ensureFile(p) } catch (e) { setErr((e as Error).message) }
    const els = elements ?? (p.scene.elements?.length ? p.scene.elements : bgElements(p))
    applying.current = true
    api.current.updateScene({ elements: els, captureUpdate: CaptureUpdateAction.NEVER })
    api.current.history.clear()
    applying.current = false
    lastSig.current = sig(els)
    if (!elements) setTimeout(() => api.current?.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.95 }), 50)
  }, [])

  useEffect(() => { if (pages.length) show(Math.min(cur, pages.length - 1)) }, [cur, pages.length, show])

  // Jonli efir: o'qituvchi chizgani o'quvchilarga darhol boradi
  useEffect(() => {
    const ch = supabase.channel('board-' + lessonId, { config: { broadcast: { self: false } } })
    if (!canEdit) {
      ch.on('broadcast', { event: 'scene' }, ({ payload }) => {
        if (!followRef.current) return
        const idx = pagesRef.current.findIndex((p) => p.id === payload.page)
        if (idx < 0) { load(); return }
        if (idx !== curRef.current) { setCur(idx); setTimeout(() => show(idx, payload.elements), 30) }
        else show(idx, payload.elements)
      })
      ch.on('broadcast', { event: 'pages' }, () => load())
    }
    ch.subscribe()
    chan.current = ch
    return () => { supabase.removeChannel(ch); chan.current = null }
  }, [lessonId, canEdit, load, show])

  const sig = (els: readonly ExcalidrawElement[]) => els.map((e) => e.id + ':' + e.version).join(',')

  const onChange = (els: readonly ExcalidrawElement[]) => {
    if (!canEdit || applying.current) return
    const p = pagesRef.current[curRef.current]
    if (!p) return
    const s = sig(els)
    if (s === lastSig.current) return
    lastSig.current = s
    const live = els.filter((e) => !e.isDeleted)
    // efirga (ko'pi bilan 5 marta/soniya)
    const now = Date.now()
    const send = () => { sendT.current = Date.now(); chan.current?.send({ type: 'broadcast', event: 'scene', payload: { page: p.id, elements: live } }) }
    if (now - sendT.current > 200) send(); else setTimeout(send, 200)
    // bazaga saqlash
    window.clearTimeout(saveT.current)
    saveT.current = window.setTimeout(async () => {
      const scene: Scene = { ...p.scene, elements: live as ExcalidrawElement[] }
      p.scene = scene
      await supabase.from('board_pages').update({ scene, updated_at: new Date().toISOString() }).eq('id', p.id)
    }, 1200)
  }

  const goto = (i: number) => {
    setCur(i)
    if (canEdit) {
      const p = pagesRef.current[i]
      const els = p.scene.elements?.length ? p.scene.elements : bgElements(p)
      chan.current?.send({ type: 'broadcast', event: 'scene', payload: { page: p.id, elements: els } })
    }
  }

  const addBlank = async () => {
    const { error } = await supabase.from('board_pages').insert({ lesson_id: lessonId, position: pages.length, kind: 'blank' })
    if (error) return setErr(error.message)
    await load(); chan.current?.send({ type: 'broadcast', event: 'pages', payload: {} })
    goto(pages.length)
  }

  // PDF (slayd) sahifalarini rasmga aylantirib doskaga qo'shish
  const addPdf = async (file: File) => {
    setErr(null)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      if (/\.(png|jpe?g|webp)$/i.test(file.name)) return addImages([file])
      return setErr("Word yoki PowerPoint faylni avval PDF qilib saqlang (Fayl → Saqlash → PDF), keyin shu yerga qo'shing.")
    }
    setBusy('PDF ochilmoqda…')
    try {
      const pdfjs = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      const blobs: { b: Blob; w: number; h: number }[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        setBusy(`Sahifa ${n} / ${doc.numPages} tayyorlanmoqda…`)
        const page = await doc.getPage(n)
        const vp0 = page.getViewport({ scale: 1 })
        const scale = 1600 / Math.max(vp0.width, vp0.height)
        const vp = page.getViewport({ scale })
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
        await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise
        const b = await new Promise<Blob>((r) => c.toBlob((x) => r(x!), 'image/png'))
        blobs.push({ b, w: Math.round(vp.width), h: Math.round(vp.height) })
      }
      await saveImagePages(blobs, file.name.replace(/\.pdf$/i, ''))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  const addImages = async (files: File[]) => {
    setBusy('Rasm yuklanmoqda…')
    try {
      const blobs = await Promise.all(files.map(async (f) => {
        const img = await createImageBitmap(f)
        return { b: f as Blob, w: img.width, h: img.height }
      }))
      await saveImagePages(blobs, files[0].name)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  const saveImagePages = async (blobs: { b: Blob; w: number; h: number }[], title: string) => {
    const start = pagesRef.current.length
    for (let i = 0; i < blobs.length; i++) {
      setBusy(`Yuklanmoqda ${i + 1} / ${blobs.length}…`)
      const path = `${lessonId}/board/${safeName(title)}_${i + 1}.png`
      await uploadFile(path, new File([blobs[i].b], 'p.png', { type: 'image/png' }))
      const { error } = await supabase.from('board_pages').insert({
        lesson_id: lessonId, position: start + i, kind: 'image', title: `${title} · ${i + 1}`,
        background_path: path, scene: { bg: { w: blobs[i].w, h: blobs[i].h } },
      })
      if (error) throw new Error(error.message)
    }
    await load(); chan.current?.send({ type: 'broadcast', event: 'pages', payload: {} })
    goto(start)
  }

  const removePage = async () => {
    const p = pages[cur]
    if (!p || pages.length < 2 || !confirm("Shu sahifa o'chirilsinmi?")) return
    await supabase.from('board_pages').delete().eq('id', p.id)
    setCur(Math.max(0, cur - 1)); await load()
    chan.current?.send({ type: 'broadcast', event: 'pages', payload: {} })
  }

  const download = async () => {
    if (!api.current) return
    const blob = await exportToBlob({ elements: api.current.getSceneElements(), files: api.current.getFiles(), appState: { exportBackground: true, viewBackgroundColor: '#ffffff' }, mimeType: 'image/png', exportPadding: 16 })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `doska_${cur + 1}.png`; a.click()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Doska sahifalari">
          {pages.map((p, i) => (
            <button key={p.id} role="tab" aria-selected={i === cur} title={p.title ?? `${i + 1}-sahifa`} onClick={() => goto(i)}
              className={`h-9 min-w-9 cursor-pointer rounded-lg px-2 text-sm font-semibold ${i === cur ? 'border-0 bg-brand text-white' : 'border border-field bg-white text-ink'}`}>{i + 1}</button>
          ))}
        </div>
        <div className="flex-1" />
        {canEdit && <>
          <button className="btn-ghost h-9 px-3 text-sm" onClick={addBlank}><Icon name="plus" size={16} />Bo'sh sahifa</button>
          <label className="btn-ghost h-9 cursor-pointer px-3 text-sm"><Icon name="upload" size={16} />PDF / slayd / rasm
            <input type="file" accept=".pdf,application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) addPdf(f); e.target.value = '' }} />
          </label>
          {pages.length > 1 && <button className="btn-ghost h-9 px-3 text-sm" onClick={removePage} aria-label="Sahifani o'chirish"><Icon name="trash" size={16} /></button>}
        </>}
        {!canEdit && live && (
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />O'qituvchini kuzatish</label>
        )}
        <button className="btn-ghost h-9 px-3 text-sm" onClick={download}><Icon name="download" size={16} />Yuklab olish</button>
      </div>
      {busy && <div className="rounded-xl bg-brand-soft px-4 py-2 text-sm text-brand-dark">{busy}</div>}
      {err && <ErrorBox text={err} />}
      <div className="h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-white">
        <Excalidraw
          excalidrawAPI={(a) => { api.current = a }}
          onChange={onChange}
          viewModeEnabled={!canEdit}
          langCode="ru-RU"
          initialData={{ appState: { viewBackgroundColor: '#ffffff', currentItemStrokeColor: '#1D4ED8', currentItemStrokeWidth: 2 } }}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false, changeViewBackgroundColor: true }, tools: { image: true } }}
        />
      </div>
    </div>
  )
}
