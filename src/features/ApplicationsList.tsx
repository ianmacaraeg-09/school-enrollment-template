import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { account, allGrades, dateText, fullName, gradeName, money, requirementProgress } from '../core/logic.ts'
import type { AppStatus } from '../core/types.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Avatar, Card, Empty, PageHeader, StatusBadge } from '../ui/kit.tsx'

export default function ApplicationsList() {
  const { config, applications, payments, sections, can } = useData()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const grade = params.get('grade') ?? ''
  const t = config.terms
  const upd = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return applications
      .filter((a) => (!status || a.status === status) && (!grade || a.gradeId === grade))
      .filter((a) => !needle || `${a.firstName} ${a.lastName} ${a.applicationNo} ${a.studentNo} ${a.guardian.name}`.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [applications, q, status, grade])

  return (
    <>
      <PageHeader title={`${t.application}s`} sub={`${rows.length} of ${applications.length} shown`}>
        <button className="btn" onClick={() =>
          downloadCsv('applications.csv', ['Application No', 'Student No', 'Last name', 'First name', t.gradeLevel, t.section, 'Status', 'Guardian', 'Phone', 'Applied'],
            rows.map((a) => [a.applicationNo, a.studentNo, a.lastName, a.firstName, gradeName(config, a.gradeId), sections.find((s) => s.id === a.sectionId)?.name ?? '', config.statusLabels[a.status], a.guardian.name, a.guardian.phone, a.createdAt.slice(0, 10)]))}>
          Export CSV
        </button>
      </PageHeader>

      <Card pad={false}>
        <div className="quick" role="group" aria-label="Quick filter">
          <button className={`chip ${status === '' ? 'on' : ''}`} onClick={() => upd('status', '')}>Everyone<b>{applications.length}</b></button>
          {(Object.keys(config.statusLabels) as AppStatus[]).map((s) => (
            <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => upd('status', status === s ? '' : s)}>
              {config.statusLabels[s]}<b>{applications.filter((a) => a.status === s).length}</b>
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="search" placeholder="Type a name, number or guardian to search…" value={q} onChange={(e) => upd('q', e.target.value)} aria-label="Search" />
          <select value={status} onChange={(e) => upd('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {(Object.keys(config.statusLabels) as AppStatus[]).map((s) => <option key={s} value={s}>{config.statusLabels[s]}</option>)}
          </select>
          <select value={grade} onChange={(e) => upd('grade', e.target.value)} aria-label={t.gradeLevel}>
            <option value="">All {t.gradeLevel.toLowerCase()}s</option>
            {allGrades(config).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {(q || status || grade) && <button className="btn ghost" onClick={() => setParams({}, { replace: true })}>Clear</button>}
        </div>
        {rows.length === 0 ? (
          <Empty title="Nothing matches">Try a different search or clear the filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table hover">
              <thead>
                <tr><th>{t.student}</th><th>{t.gradeLevel}</th><th>Documents</th>{can('payments.view') && <th className="right">Balance</th>}<th>Applied</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const req = requirementProgress(config, a)
                  return (
                    <tr key={a.id} onClick={() => nav(`/app/applications/${a.id}`)} className="click">
                      <td>
                        <div className="who">
                          <Avatar name={fullName(a)} />
                          <div>
                            <Link to={`/app/applications/${a.id}`} onClick={(e) => e.stopPropagation()}><strong>{fullName(a)}</strong></Link>
                            <div className="muted small">{a.studentNo || a.applicationNo}</div>
                          </div>
                        </div>
                      </td>
                      <td>{gradeName(config, a.gradeId)}<div className="muted small">{sections.find((s) => s.id === a.sectionId)?.name ?? 'Unplaced'}</div></td>
                      <td><span className={req.complete ? 'pill good' : 'pill warn'}>{req.mandatory.length - req.missing.length}/{req.mandatory.length}</span></td>
                      {can('payments.view') && <td className="right">{a.status === 'approved' || a.status === 'enrolled' ? money(config, account(config, a, payments).balance) : <span className="muted">—</span>}</td>}
                      <td>{dateText(config, a.createdAt)}</td>
                      <td><StatusBadge status={a.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
