import { PageHead } from '../components/ui'
export default function Soon({ title }: { title: string }) {
  return (
    <>
      <PageHead title={title} />
      <div className="card p-6 text-muted">Bu bo'lim keyingi bosqichda qo'shiladi.</div>
    </>
  )
}
