import { Fragment } from 'react'
import { useData } from '../core/DataContext.tsx'
import { account, allGrades, fullName, gradeName, money, round2 } from '../core/logic.ts'
import type { AppStatus } from '../core/types.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Card, PageHeader } from '../ui/kit.tsx'

const ORDER: AppStatus[] = ['applied', 'review', 'approved', 'enrolled', 'waitlisted', 'declined', 'withdrawn']

export default function Reports() {
  const { config, applications, payments, sections, can } = useData()
  const t = config.terms
  const sy = config.activeSchoolYearId
  const apps = applications.filter((a) => a.schoolYearId === sy)
  const enrolled = apps.filter((a) => a.status === 'enrolled')
  const secName = (id: string) => sections.find((s) => s.id === id)?.name ?? ''
  const showMoney = can('payments.view')

  const byMethod = config.paymentMethods.map((m) => ({ m, total: round2(payments.filter((p) => !p.voided && p.method === m).reduce((s, p) => s + p.amount, 0)) }))
  const sexCount = (s: string) => enrolled.filter((a) => a.sex === s).length

  return (
    <>
      <PageHeader title="Reports" sub={`${config.schoolYears.find((s) => s.id === sy)?.name} · exports open in Excel`} />

      <div className="cols">
        <Card title="Enrollment by grade" pad={false}>
          <div className="table-wrap"><table className="table compact">
            <thead><tr><th>{t.gradeLevel}</th>{ORDER.map((s) => <th key={s} className="right">{config.statusLabels[s]}</th>)}</tr></thead>
            <tbody>
              {allGrades(config).map((g) => (
                <tr key={g.id}><td>{g.name}</td>{ORDER.map((s) => <td key={s} className="right">{apps.filter((a) => a.gradeId === g.id && a.status === s).length || '·'}</td>)}</tr>
              ))}
              <tr className="total"><td>Total</td>{ORDER.map((s) => <td key={s} className="right">{apps.filter((a) => a.status === s).length}</td>)}</tr>
            </tbody>
          </table></div>
        </Card>

        <div className="stack">
          <Card title={`Enrolled ${t.students.toLowerCase()}`}>
            <dl className="kv two">
              <dt>Total</dt><dd><strong>{enrolled.length}</strong></dd>
              <dt>Male / Female</dt><dd>{sexCount('Male')} / {sexCount('Female')}</dd>
              <dt>New</dt><dd>{enrolled.filter((a) => a.studentType === 'new').length}</dd>
              <dt>Transferees</dt><dd>{enrolled.filter((a) => a.studentType === 'transferee').length}</dd>
              <dt>Returning</dt><dd>{enrolled.filter((a) => a.studentType === 'returning').length}</dd>
            </dl>
          </Card>
          {showMoney && (
            <Card title="Collections by method">
              <dl className="kv two">{byMethod.map((x) => <Fragment key={x.m}><dt>{x.m}</dt><dd>{money(config, x.total)}</dd></Fragment>)}</dl>
            </Card>
          )}
        </div>
      </div>

      <Card title="Export">
        <div className="row gap wrap">
          <button className="btn" onClick={() =>
            downloadCsv('masterlist-enrolled.csv', [`${t.student} No`, 'Last name', 'First name', 'Middle name', 'Sex', 'Birth date', t.gradeLevel, t.track, t.section, 'Type', t.guardian, 'Phone', 'Email', 'Address'],
              enrolled.map((a) => [a.studentNo, a.lastName, a.firstName, a.middleName, a.sex, a.birthDate, gradeName(config, a.gradeId), config.tracks.find((x) => x.id === a.trackId)?.name ?? '', secName(a.sectionId), a.studentType, a.guardian.name, a.guardian.phone, a.guardian.email, a.address]))}>
            Enrolled masterlist (CSV)
          </button>
          <button className="btn" onClick={() =>
            downloadCsv('class-lists.csv', [t.section, 'Last name', 'First name', `${t.student} No`, 'Sex'],
              enrolled.filter((a) => a.sectionId).sort((x, y) => secName(x.sectionId).localeCompare(secName(y.sectionId)) || x.lastName.localeCompare(y.lastName)).map((a) => [secName(a.sectionId), a.lastName, a.firstName, a.studentNo, a.sex]))}>
            Class lists (CSV)
          </button>
          {showMoney && (
            <button className="btn" onClick={() =>
              downloadCsv('accounts-receivable.csv', [t.student, 'Number', t.gradeLevel, 'Assessed', 'Paid', 'Balance'],
                apps.filter((a) => a.status === 'approved' || a.status === 'enrolled').map((a) => { const c = account(config, a, payments); return [fullName(a), a.studentNo || a.applicationNo, gradeName(config, a.gradeId), c.assessment.total, c.paid, c.balance] }))}>
              Accounts receivable (CSV)
            </button>
          )}
        </div>
      </Card>
    </>
  )
}
