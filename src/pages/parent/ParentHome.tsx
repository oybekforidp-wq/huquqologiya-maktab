import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useQuery, must } from '../../lib/useQuery'
import { Empty, ErrorBox, PageHead, Spinner } from '../../components/ui'

export default function ParentHome() {
  const kids = useQuery(() => must<{ id: string; full_name: string; login: string }[]>(supabase.rpc('my_children')))
  return (
    <>
      <PageHead title="Farzandlarim" sub="Faqat kuzatuv: guruhlar, davomat, vazifa ballari va baholar." />
      {kids.error && <ErrorBox text={kids.error} />}
      {kids.loading ? <Spinner /> : !kids.data?.length ? (
        <Empty title="Farzand biriktirilmagan" text="Admin farzandingizni hisobingizga bog'lagach, ma'lumotlar shu yerda chiqadi." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kids.data.map((k) => (
            <Link key={k.id} to={`/farzand/${k.id}`} className="card flex flex-col gap-1 p-5 text-ink no-underline hover:bg-bg">
              <span className="text-lg font-semibold">{k.full_name}</span>
              <span className="text-sm text-muted">login: {k.login}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
