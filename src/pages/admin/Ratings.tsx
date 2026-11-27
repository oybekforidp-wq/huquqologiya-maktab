import { supabase } from '../../lib/supabase'
import { useQuery, must } from '../../lib/useQuery'
import { Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'
import { Stars } from '../../components/Stars'

type Row = { teacher_id: string; full_name: string; lesson_avg: number | null; lesson_count: number; parent_avg: number | null; parent_count: number }

const cell = (avg: number | null, n: number) => avg == null ? <span className="text-muted">—</span> : (
  <span className="flex items-center gap-2"><Stars value={Number(avg)} size={16} /><b>{Number(avg).toFixed(2)}</b><span className="text-muted">({n})</span></span>
)

export default function Ratings() {
  const rows = useQuery(() => must<Row[]>(supabase.rpc('teacher_ratings_overview')))
  return (
    <>
      <PageHead title="Ustoz reytingi" sub="O'quvchilar (har bir darsdan keyin) va ota-onalar baholari." />
      {rows.error && <ErrorBox text={rows.error} />}
      {rows.loading ? <Spinner /> : !rows.data?.length ? <Empty title="Ustoz yo'q" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-muted"><th className="p-3">USTOZ</th><th className="p-3">O'QUVCHILAR BAHOSI</th><th className="p-3">OTA-ONALAR BAHOSI</th></tr></thead>
            <tbody>
              {rows.data.map((r) => (
                <tr key={r.teacher_id} className="border-t border-line">
                  <td className="p-3 font-medium">{r.full_name}</td>
                  <td className="p-3">{cell(r.lesson_avg, r.lesson_count)}</td>
                  <td className="p-3">{cell(r.parent_avg, r.parent_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
