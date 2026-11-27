export function Stars({ value, onChange, size = 32 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} yulduz`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value)
        const star = <span style={{ fontSize: size, lineHeight: 1 }} className={on ? 'text-amber-500' : 'text-slate-300'}>★</span>
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} yulduz`} onClick={() => onChange(n)}
            className="cursor-pointer border-0 bg-transparent p-1">{star}</button>
        ) : <span key={n}>{star}</span>
      })}
    </div>
  )
}
