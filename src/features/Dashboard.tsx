import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { account, allGrades, dateText, fullName, gradeName, money, requirementProgress, round2, sectionLoad } from '../core/logic.ts'
import type { AppStatus } from '../core/types.ts'
import { Avatar, Card, Empty, PageHeader, ProgressBar, Stat, StatusBadge } from '../ui/kit.tsx'
import { Columns, Donut } from '../ui/charts.tsx'
import { Icon } from '../ui/Layout.tsx'

const STATUS_COLOR: Record<AppStatus, string> = {
  applied: '#6366f1', review: '#f59e0b', approved: '#3b82f6', enrolled: '#16a34a', waitlisted: '#a855f7', declined: '#ef4444', withdrawn: '#94a3b8',
}
const ORDER: AppStatus[] = ['applied', 'review', 'approved', 'enrolled', 'waitlisted', 'declined', 'withdrawn']

export default function Dashboard() {
  const { config, applications, payments, sections, can, loadDemo, toast } = useData()
  const t = config.terms
  const sy = config.activeSchoolYearId
  const apps = applications.filter((a) => a.schoolYearId === sy)
  const count = (s: AppStatus) => apps.filter((a) => a.status === s).length
  const mySections = sections.filter((s) => s.schoolYearId === sy)
  const seatsTotal = mySections.reduce((n, s) => n + s.capacity, 0)
  const seatsUsed = mySections.reduce((n, s) => n + sectionLoad(s, applications).used, 0)
  const live = apps.filter((a) => a.status === 'approved' || a.status === 'enrolled')
  const accounts = live.map((a) => account(config, a, payments))
  const collected = round2(accounts.reduce((s, x) => s + x.paid, 0))
  const outstanding = round2(accounts.reduce((s, x) => s + Math.max(0, x.balance), 0))
  const syName = config.schoolYears.find((s) => s.id === sy)?.name ?? ''
  const recent = [...apps].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const missingDocs = apps.filter((a) => ['applied', 'review', 'approved'].includes(a.status) && !requirementProgress(config, a).complete).length
  const enrolled = count('enrolled')

  // applications received per month (latest 6 months that have data)
  const byMonth = new Map<string, number>()
  for (const a of apps) byMonth.set(a.createdAt.slice(0, 7), (byMonth.get(a.createdAt.slice(0, 7)) ?? 0) + 1)
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6)
    .map(([k, v]) => ({ label: new Date(`${k}-15`).toLocaleDateString(config.locale.dateLocale, { month: 'short' }), value: v }))

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const todo: { n: number; text: string; to: string }[] = [
    { n: count('applied'), text: `new ${t.application.toLowerCase()}${count('applied') === 1 ? '' : 's'} waiting to be looked at`, to: '/app/applications?status=applied' },
    { n: count('review'), text: 'in review — decide to approve or decline', to: '/app/applications?status=review' },
    { n: count('approved'), text: 'approved — ready to enroll once papers and payment are in', to: '/app/applications?status=approved' },
    { n: missingDocs, text: 'still missing required documents', to: '/app/applications' },
  ].filter((x) => x.n > 0)
  const link = `${window.location.origin}${window.location.pathname}#/apply`
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied. Paste it in a message or post it on your page.') }
    catch { toast(link) }
  }

  if (applications.length === 0)
    return (
      <>
        <PageHeader title="Dashboard" sub={`${config.school.name} · ${syName}`} />
        <Card>
          <Empty title="No applications yet">
            Add a walk-in {t.application.toLowerCase()}, share the online form with parents, or load sample data to explore the system.
          </Empty>
          <div className="row gap center">
            {can('applications.edit') && <Link className="btn primary" to="/app/applications/new">New {t.application.toLowerCase()}</Link>}
            {can('settings.edit') && <button className="btn" onClick={async () => { await loadDemo(); toast('Sample data loaded') }}>Load sample data</button>}
          </div>
        </Card>
      </>
    )

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <p className="hero-hi">{greet}. Here is {syName} at {config.school.shortName}.</p>
          <div className="hero-num"><strong>{enrolled}</strong><span>{t.student.toLowerCase()}s enrolled</span></div>
          <div className="hero-seats">
            <div className="hero-bar"><span style={{ width: `${seatsTotal ? Math.min(100, (seatsUsed / seatsTotal) * 100) : 0}%` }} /></div>
            <span>{seatsUsed} of {seatsTotal} seats taken{seatsTotal ? ` (${Math.round((seatsUsed / seatsTotal) * 100)}%)` : ''}</span>
          </div>
          <div className="row gap wrap hero-cta">
            {can('applications.edit') && <Link className="btn light" to="/app/applications/new"><Icon name="plus" size={18} />Add a {t.student.toLowerCase()}</Link>}
            {config.rules.onlineApplication && <button className="btn glass" onClick={copyLink}><Icon name="link" size={18} />Copy parent form link</button>}
          </div>
        </div>
        <div className="hero-ring">
          <Donut center={apps.length} sub="applications"
            data={ORDER.map((s) => ({ label: config.statusLabels[s], value: count(s), color: STATUS_COLOR[s], to: `/app/applications?status=${s}` }))} />
        </div>
      </section>

      <div className="stats">
        <Stat to="/app/applications?status=applied" label="Waiting for review" value={count('applied') + count('review')} tone={count('applied') > 0 ? 'warn' : undefined} hint={`${count('applied')} new · ${count('review')} in review`} />
        <Stat to="/app/applications?status=approved" label="Approved, not enrolled" value={count('approved')} hint="waiting for papers or payment" />
        {can('payments.view') && <Stat to="/app/payments" label="Money received" value={money(config, collected)} tone="good" />}
        {can('payments.view') && <Stat to="/app/payments" label="Still to collect" value={money(config, outstanding)} tone={outstanding > 0 ? 'warn' : undefined} hint="from approved and enrolled" />}
      </div>

      <div className="cols">
        <Card title="Needs your attention">
          {todo.length === 0 ? (
            <div className="allclear">You are all caught up. Nothing is waiting.</div>
          ) : (
            <ul className="todo">
              {todo.map((x) => (
                <li key={x.to + x.text}><Link to={x.to}><span className="count">{x.n}</span><span>{x.text}</span><span className="go">Open</span></Link></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Applications received" actions={<span className="muted small">per month</span>}>
          {months.length > 0 ? <Columns data={months} /> : <p className="muted">No data yet.</p>}
        </Card>
      </div>

      <div className="cols">
        <Card title="Latest applications" actions={<Link to="/app/applications" className="btn ghost">View all</Link>} pad={false}>
          <ul className="people">
            {recent.map((a) => (
              <li key={a.id}>
                <Link to={`/app/applications/${a.id}`}>
                  <Avatar name={fullName(a)} />
                  <div className="grow"><strong>{fullName(a)}</strong><div className="muted small">{gradeName(config, a.gradeId)} · {dateText(config, a.createdAt)}</div></div>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`By ${t.gradeLevel.toLowerCase()}`} pad={false}>
          <div className="table-wrap scroll-y">
            <table className="table compact">
              <thead>
                <tr><th>{t.gradeLevel}</th><th className="right">Applied</th><th className="right">Enrolled</th><th className="w-capacity">Seats</th></tr>
              </thead>
              <tbody>
                {allGrades(config).map((g) => {
                  const ga = apps.filter((a) => a.gradeId === g.id)
                  const secs = mySections.filter((s) => s.gradeId === g.id)
                  const cap = secs.reduce((n, s) => n + s.capacity, 0)
                  const used = secs.reduce((n, s) => n + sectionLoad(s, applications).used, 0)
                  return (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td className="right">{ga.length}</td>
                      <td className="right">{ga.filter((a) => a.status === 'enrolled').length}</td>
                      <td>{cap ? <div className="cap"><ProgressBar value={used} max={cap} /><span className="small muted">{used}/{cap}</span></div> : <span className="muted small">no sections</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
