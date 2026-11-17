import { Link } from 'react-router-dom'

export interface Slice { label: string; value: number; color: string; to?: string }

/** Ring chart with a clickable legend. `center` is shown in the hole. */
export function Donut({ data, center, sub }: { data: Slice[]; center: string | number; sub?: string }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Status breakdown">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
        {total > 0 && data.filter((d) => d.value > 0).map((d) => {
          const len = (d.value / total) * c
          const el = (
            <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)">
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-n">{center}</text>
        {sub && <text x="70" y="86" textAnchor="middle" className="donut-s">{sub}</text>}
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.label}>
            {d.to ? <Link to={d.to}><i style={{ background: d.color }} />{d.label}<b>{d.value}</b></Link> : <span><i style={{ background: d.color }} />{d.label}<b>{d.value}</b></span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Simple column chart; hover a bar to read its value. */
export function Columns({ data, unit = '' }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="columns" role="img" aria-label="Chart">
      {data.map((d) => (
        <div key={d.label} className="col" title={`${d.label}: ${d.value}${unit}`}>
          <span className="col-val">{d.value}</span>
          <span className="col-bar" style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} />
          <span className="col-lab">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
