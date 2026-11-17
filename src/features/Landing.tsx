import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { money, sectionLoad } from '../core/logic.ts'
import type { StudentType } from '../core/types.ts'
import { Logo } from '../ui/Layout.tsx'
import { Toasts } from '../ui/kit.tsx'
import PublicApply from './PublicApply.tsx'
import Track from './Track.tsx'

const TYPE_LABEL: Record<StudentType, string> = { new: 'New student', transferee: 'Transferee', returning: 'Returning student' }

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

export default function Landing() {
  const { config, sections, applications } = useData()
  const t = config.terms
  const L = config.landing
  const online = config.rules.onlineApplication
  const sy = config.schoolYears.find((s) => s.id === config.activeSchoolYearId)
  const [levelId, setLevelId] = useState(config.levels[0]?.id ?? '')
  const [type, setType] = useState<StudentType>('new')
  const [faq, setFaq] = useState<string | null>(L.faqs[0]?.id ?? null)
  const [active, setActive] = useState('top')
  const [stuck, setStuck] = useState(false)
  const [menu, setMenu] = useState(false)

  const nav = [
    { id: 'about', label: 'About' },
    { id: 'programs', label: 'Programs' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'tuition', label: 'Tuition' },
    ...(online ? [{ id: 'apply', label: 'Apply' }] : []),
    { id: 'faq', label: 'FAQ' },
    { id: 'contact', label: 'Contact' },
  ]

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    ;['top', ...nav.map((n) => n.id), 'track'].forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const seats = useMemo(() => {
    const mine = sections.filter((s) => s.schoolYearId === config.activeSchoolYearId)
    const total = mine.reduce((n, s) => n + s.capacity, 0)
    const used = mine.reduce((n, s) => n + sectionLoad(s, applications).used, 0)
    return { total, left: Math.max(0, total - used) }
  }, [sections, applications, config.activeSchoolYearId])

  const level = config.levels.find((l) => l.id === levelId) ?? config.levels[0]
  const feesForLevel = config.fees.filter((f) => !f.optional && (f.levelIds.length === 0 || f.levelIds.includes(level?.id ?? '')))
  const optionalFees = config.fees.filter((f) => f.optional && (f.levelIds.length === 0 || f.levelIds.includes(level?.id ?? '')))
  const total = feesForLevel.reduce((n, f) => n + f.amount, 0)
  const down = Math.round((total * config.rules.minDownpaymentPercent) / 100)
  const reqs = config.requirements.filter((r) => r.studentTypes.length === 0 || r.studentTypes.includes(type))
  const levelName = (ids: string[]) => ids.map((id) => config.levels.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
  const dateLong = (d: string) => new Date(d).toLocaleDateString(config.locale.dateLocale, { month: 'long', day: 'numeric', year: 'numeric' })

  const steps = [
    { title: `Submit the online form`, text: `Fill in the ${t.application.toLowerCase()} below. It takes about 5 minutes and you get a reference number right away.` },
    { title: 'Bring your documents', text: 'Hand in the requirements listed on this page to the registrar. You can check what is still missing at any time.' },
    { title: 'Wait for approval', text: `The registrar reviews your ${t.application.toLowerCase()} and contacts you, usually within a few school days.` },
    { title: 'Pay and get your section', text: `Settle the down payment (${config.rules.minDownpaymentPercent}% of fees) and your child is placed in a ${t.section.toLowerCase()}. You will receive an official receipt.` },
  ]

  return (
    <div className="site" id="top">
      <header className={`site-head ${stuck || menu ? 'stuck' : ''}`}>
        <button className="brand" onClick={() => { go('top'); setMenu(false) }} aria-label={`${config.school.name} home`}>
          <Logo size={42} />
          <div><strong>{config.school.name}</strong><span>{config.school.tagline}</span></div>
        </button>
        <nav className={`site-nav ${menu ? 'open' : ''}`} aria-label="Sections">
          {nav.map((n) => (
            <button key={n.id} className={active === n.id ? 'on' : ''} onClick={() => { go(n.id); setMenu(false) }}>{n.label}</button>
          ))}
          <Link to="/app" className="staff-link">Staff sign-in</Link>
        </nav>
        {online && <button className="btn primary head-cta" onClick={() => go('apply')}>Apply now</button>}
        <button className="btn ghost icon site-burger" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>{menu ? '✕' : '☰'}</button>
      </header>

      {/* hero */}
      <section className="s-hero">
        <div className="s-hero-copy">
          <span className="s-pill"><i />Enrollment is open{sy ? ` for ${sy.name}` : ''}</span>
          <h1>{L.heroTitle}</h1>
          <p>{L.heroText}</p>
          <div className="row gap wrap">
            {online && <button className="btn light lg" onClick={() => go('apply')}>Start your application</button>}
            <button className="btn glass lg" onClick={() => go('admissions')}>How admission works</button>
          </div>
        </div>
        <aside className="s-hero-card" aria-label="Admission summary">
          <h2>Admissions at a glance</h2>
          {seats.total > 0 && (
            <div className="s-seats">
              <strong>{seats.left}</strong>
              <span>seats still open across {config.levels.length} levels</span>
              <div className="hero-bar"><span style={{ width: `${((seats.total - seats.left) / seats.total) * 100}%` }} /></div>
            </div>
          )}
          <ul>
            {sy && <li><b>Classes begin</b>{dateLong(sy.startDate)}</li>}
            <li><b>Down payment</b>{config.rules.minDownpaymentPercent}% of fees to reserve a slot</li>
            <li><b>Levels</b>{config.levels.map((l) => l.name).join(' · ')}</li>
          </ul>
          {online && <button className="btn primary block" onClick={() => go('apply')}>Apply online</button>}
        </aside>
      </section>

      {/* numbers */}
      <section className="s-stats" aria-label="School facts">
        {L.stats.map((s) => <div key={s.id}><strong>{s.value}</strong><span>{s.label}</span></div>)}
      </section>

      {/* about */}
      <section className="s-sec" id="about">
        <div className="s-wrap s-about">
          <div>
            <h2 className="s-h">About {config.school.shortName}</h2>
            <p className="s-lead">{L.about}</p>
          </div>
          <div className="s-grid2">
            {L.highlights.map((h) => (
              <article key={h.id} className="s-card">
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* programs */}
      <section className="s-sec alt" id="programs">
        <div className="s-wrap">
          <h2 className="s-h">Programs by level</h2>
          <p className="s-sub">From the first day of Kinder to graduation. Choose a level to see its {t.gradeLevel.toLowerCase()}s{config.tracks.length ? ` and ${t.track.toLowerCase()}s` : ''}.</p>
          <div className="s-levels">
            {config.levels.map((l) => (
              <article key={l.id} className="s-card level">
                <h3>{l.name}</h3>
                <p className="muted small">{l.grades.length} {t.gradeLevel.toLowerCase()}{l.grades.length === 1 ? '' : 's'}</p>
                <div className="chips">{l.grades.map((g) => <span key={g.id} className="chip static">{g.name}</span>)}</div>
                {config.tracks.some((tr) => tr.gradeIds.some((id) => l.grades.some((g) => g.id === id))) && (
                  <>
                    <p className="small"><b>{t.track}s offered</b></p>
                    <div className="chips">{config.tracks.filter((tr) => tr.gradeIds.some((id) => l.grades.some((g) => g.id === id))).map((tr) => <span key={tr.id} className="chip static accent">{tr.name}</span>)}</div>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* admissions */}
      <section className="s-sec" id="admissions">
        <div className="s-wrap">
          <h2 className="s-h">How admission works</h2>
          <ol className="s-steps">
            {steps.map((s, i) => (
              <li key={s.title}><span className="n">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></li>
            ))}
          </ol>

          <div className="s-req">
            <div>
              <h3 className="s-h3">What to bring</h3>
              <p className="muted">Pick who is applying to see the documents that apply.</p>
              <div className="seg" role="tablist" aria-label="Student type">
                {(['new', 'transferee', 'returning'] as StudentType[]).map((k) => (
                  <button key={k} role="tab" aria-selected={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{TYPE_LABEL[k]}</button>
                ))}
              </div>
            </div>
            <ul className="s-checks">
              {reqs.map((r) => (
                <li key={r.id}>
                  <span className={`tick ${r.required ? '' : 'opt'}`}>{r.required ? '✓' : '○'}</span>
                  <div>
                    <strong>{r.name}</strong>
                    <span className="muted small">{r.required ? 'Required' : 'Optional'}{r.levelIds.length ? ` · ${levelName(r.levelIds)}` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* tuition */}
      <section className="s-sec alt" id="tuition">
        <div className="s-wrap">
          <h2 className="s-h">Tuition and fees</h2>
          <p className="s-sub">Pick a level to see what a year costs. Amounts are in {config.locale.currencySymbol}. Optional items are only charged if you choose them.</p>
          <div className="seg" role="tablist" aria-label="Level">
            {config.levels.map((l) => (
              <button key={l.id} role="tab" aria-selected={levelId === l.id} className={levelId === l.id ? 'on' : ''} onClick={() => setLevelId(l.id)}>{l.name}</button>
            ))}
          </div>
          <div className="s-fees">
            <div className="s-card">
              <h3>{level?.name} — yearly fees</h3>
              <table className="s-table">
                <tbody>
                  {feesForLevel.map((f) => <tr key={f.id}><td>{f.name}</td><td className="right">{money(config, f.amount)}</td></tr>)}
                  <tr className="sum"><td>Total</td><td className="right">{money(config, total)}</td></tr>
                  {config.rules.minDownpaymentPercent > 0 && <tr><td className="muted">Down payment to reserve a slot ({config.rules.minDownpaymentPercent}%)</td><td className="right"><b>{money(config, down)}</b></td></tr>}
                </tbody>
              </table>
              {optionalFees.length > 0 && (
                <>
                  <h4>Optional items</h4>
                  <table className="s-table">
                    <tbody>{optionalFees.map((f) => <tr key={f.id}><td>{f.name}</td><td className="right">{money(config, f.amount)}</td></tr>)}</tbody>
                  </table>
                </>
              )}
            </div>
            <div className="s-side">
              {config.discounts.length > 0 && (
                <div className="s-card">
                  <h3>Discounts and scholarships</h3>
                  <ul className="s-list">{config.discounts.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
                </div>
              )}
              <div className="s-card">
                <h3>Ways to pay</h3>
                <div className="chips">{config.paymentMethods.map((m) => <span key={m} className="chip static">{m}</span>)}</div>
                <p className="muted small">Pay in full or in installments. Every payment gets an official receipt.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* apply */}
      <section className="s-sec" id="apply">
        <div className="s-wrap narrow-wrap">
          <h2 className="s-h center">Apply online</h2>
          {online ? (
            <>
              <p className="s-sub center">School year {sy?.name}. Fields marked * are required. You will get a reference number as soon as you submit.</p>
              <PublicApply embedded />
            </>
          ) : (
            <p className="s-sub center">Online applications are closed right now. Please visit or call the registrar's office to apply.</p>
          )}
        </div>
      </section>

      {online && (
        <section className="s-sec alt" id="track">
          <div className="s-wrap narrow-wrap">
            <h2 className="s-h center">Already applied?</h2>
            <p className="s-sub center">Check your status and see which documents are still missing.</p>
            <Track embedded />
          </div>
        </section>
      )}

      {/* faq */}
      <section className="s-sec" id="faq">
        <div className="s-wrap narrow-wrap">
          <h2 className="s-h center">Questions parents ask</h2>
          <div className="s-faq">
            {L.faqs.map((f) => (
              <div key={f.id} className={`faq ${faq === f.id ? 'open' : ''}`}>
                <button onClick={() => setFaq(faq === f.id ? null : f.id)} aria-expanded={faq === f.id}>
                  <span>{f.q}</span><i aria-hidden="true">{faq === f.id ? '−' : '+'}</i>
                </button>
                {faq === f.id && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* contact */}
      <section className="s-sec contact" id="contact">
        <div className="s-wrap s-contact">
          <div>
            <h2 className="s-h">Visit or contact us</h2>
            <p className="s-sub">The registrar's office is happy to answer questions and help you complete an application.</p>
          </div>
          <dl>
            <div><dt>Address</dt><dd>{config.school.address}</dd></div>
            <div><dt>Phone</dt><dd><a href={`tel:${config.school.phone.replace(/[^\d+]/g, '')}`}>{config.school.phone}</a></dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${config.school.email}`}>{config.school.email}</a></dd></div>
            <div><dt>Office hours</dt><dd>{L.officeHours}</dd></div>
          </dl>
        </div>
      </section>

      <footer className="site-foot">
        <span>© {new Date().getFullYear()} {config.school.name}. All rights reserved.</span>
        <span className="row gap"><Link to="/app">Staff sign-in</Link></span>
      </footer>
      <Toasts />
    </div>
  )
}
