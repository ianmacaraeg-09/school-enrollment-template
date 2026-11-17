import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import {
  account, ageOn, canEnroll, dateText, enrollmentReadiness, fullName, gradeName, money, optionalFeesFor,
  requirementProgress, sectionLoad, transitions,
} from '../core/logic.ts'
import type { AppStatus, Payment } from '../core/types.ts'
import { Card, Field, Modal, PageHeader, Steps, StatusBadge } from '../ui/kit.tsx'
import { PaymentModal, ReceiptModal } from './PaymentParts.tsx'

const ACTION_LABEL: Partial<Record<AppStatus, string>> = {
  review: 'Start review', approved: 'Approve', enrolled: 'Enroll', waitlisted: 'Waitlist', declined: 'Decline', withdrawn: 'Mark withdrawn',
}
const NEEDS_NOTE: AppStatus[] = ['declined', 'withdrawn', 'waitlisted']

export default function ApplicationDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const d = useData()
  const { config, applications, payments, sections, can, toast } = d
  const a = applications.find((x) => x.id === id)
  const t = config.terms
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [voiding, setVoiding] = useState<Payment | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [pending, setPending] = useState<AppStatus | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  if (!a) return <Card title="Not found"><p>That {t.application.toLowerCase()} does not exist. <Link to="/app/applications">Back to list</Link></p></Card>

  const req = requirementProgress(config, a)
  const acct = account(config, a, payments)
  const checks = enrollmentReadiness(config, a, payments)
  const mine = payments.filter((p) => p.applicationId === a.id)
  const gradeSections = sections.filter((s) => s.gradeId === a.gradeId && s.schoolYearId === a.schoolYearId)
  const optional = optionalFeesFor(config, a.gradeId)
  const track = config.tracks.find((x) => x.id === a.trackId)
  const editable = can('applications.edit')
  const age = ageOn(a.birthDate)

  async function move(to: AppStatus, why?: string) {
    const res = await d.changeStatus(a!.id, to, why)
    if (!res.ok) toast(res.error, 'error')
    else toast(`Status: ${config.statusLabels[to]}`)
    setPending(null)
    setReason('')
  }
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const actions = transitions[a.status].filter((s) => s !== 'enrolled' || can('applications.enroll'))
  const blocking = checks.filter((c) => !c.ok && c.blocking).map((c) => c.label.toLowerCase())
  const nextStep: { title: string; text: string; cta?: { label: string; to: AppStatus; enabled: boolean } } =
    a.status === 'applied' ? { title: 'Next: look over this application', text: 'Check the details and documents, then start the review.', cta: { label: 'Start review', to: 'review', enabled: true } }
    : a.status === 'review' ? { title: 'Next: decide', text: 'Happy with the details and papers? Approve it. Otherwise use the other options below.', cta: { label: 'Approve', to: 'approved', enabled: true } }
    : a.status === 'approved' ? (canEnroll(checks)
        ? { title: 'Everything is in place', text: `All requirements are met. You can enroll this ${t.student.toLowerCase()} now.`, cta: { label: 'Enroll now', to: 'enrolled', enabled: can('applications.enroll') } }
        : { title: 'Almost there — still needed before enrolling', text: `${blocking.join(', ').replace(/^./, (c) => c.toUpperCase())}. The "Enrollment readiness" box on this page shows how to finish each one.` })
    : a.status === 'enrolled' ? { title: `🎉 Enrolled${a.studentNo ? ` — ${t.student} no. ${a.studentNo}` : ''}`, text: 'Nothing more to do. You can still record payments or print receipts.' }
    : { title: `This ${t.application.toLowerCase()} is ${config.statusLabels[a.status].toLowerCase()}`, text: 'Use the options below if the situation changes.' }

  return (
    <>
      <PageHeader avatar={fullName(a)} title={fullName(a)} sub={`${a.studentNo ? `${t.student} no. ${a.studentNo} · ` : ''}${a.applicationNo} · ${gradeName(config, a.gradeId)}${track ? ` · ${track.name}` : ''}`}>
        <StatusBadge status={a.status} />
        {editable && <Link className="btn" to={`/app/applications/${a.id}/edit`}>Edit</Link>}
      </PageHeader>

      <Steps status={a.status} />

      <div className={`next ${a.status === 'enrolled' ? 'ok' : ''}`}>
        <div className="grow"><strong>{nextStep.title}</strong><span className="muted">{nextStep.text}</span></div>
        {nextStep.cta && can('applications.review') && (
          <button className="btn primary" disabled={!nextStep.cta.enabled} onClick={() => move(nextStep.cta!.to)}>{nextStep.cta.label}</button>
        )}
      </div>

      {can('applications.review') && actions.filter((s) => s !== nextStep.cta?.to).length > 0 && (
        <div className="action-bar">
          <span className="muted">Other options:</span>
          {actions.filter((s) => s !== nextStep.cta?.to).map((s) => (
            <button key={s} className={`btn ${s === 'enrolled' || s === 'approved' ? 'primary' : ''} ${s === 'declined' || s === 'withdrawn' ? 'danger' : ''}`}
              onClick={() => (NEEDS_NOTE.includes(s) ? setPending(s) : move(s))}
              disabled={s === 'enrolled' && !canEnroll(checks)}
              title={s === 'enrolled' && !canEnroll(checks) ? 'Complete the readiness checklist first' : undefined}>
              {ACTION_LABEL[s] ?? config.statusLabels[s]}
            </button>
          ))}
        </div>
      )}

      <div className="cols detail">
        <div className="stack">
          <Card title={`${t.student} & ${t.guardian.toLowerCase()}`}>
            <dl className="kv two">
              <dt>Birth date</dt><dd>{dateText(config, a.birthDate)}{age !== null && ` (${age} yrs)`}</dd>
              <dt>Sex</dt><dd>{a.sex || '—'}</dd>
              <dt>Type</dt><dd className="cap-first">{a.studentType}</dd>
              <dt>Previous school</dt><dd>{a.previousSchool || '—'}</dd>
              <dt>Address</dt><dd>{a.address}</dd>
              <dt>{t.guardian}</dt><dd>{a.guardian.name}{a.guardian.relationship && ` (${a.guardian.relationship})`}</dd>
              <dt>Contact</dt><dd>{a.guardian.phone}{a.guardian.email && <> · {a.guardian.email}</>}</dd>
              {config.customFields.filter((f) => a.custom[f.id] !== undefined && a.custom[f.id] !== '' && f.type !== 'checkbox').map((f) => (
                <Fragment key={f.id}><dt>{f.label}</dt><dd>{String(a.custom[f.id])}</dd></Fragment>
              ))}
              <dt>Source</dt><dd className="cap-first">{a.source}</dd>
            </dl>
          </Card>

          <Card title="Requirements" actions={<span className={req.complete ? 'pill good' : 'pill warn'}>{req.mandatory.length - req.missing.length}/{req.mandatory.length} required</span>}>
            <ul className="checklist">
              {req.all.map((r) => (
                <li key={r.id} className={a.docs[r.id] ? 'done' : ''}>
                  <label className="check-row">
                    <input type="checkbox" checked={!!a.docs[r.id]} disabled={!editable}
                      onChange={(e) => d.updateApplication({ ...a, docs: { ...a.docs, [r.id]: e.target.checked } })} />
                    <span>{r.name}</span>
                    {!r.required && <em className="muted small">optional</em>}
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="History & notes">
            {can('applications.edit') && (
              <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { d.addNote(a.id, note.trim()); setNote('') } }}>
                <input className="grow" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn">Add</button>
              </form>
            )}
            <ol className="timeline">
              {[...a.history].reverse().map((h) => (
                <li key={h.id} className={h.kind}>
                  <span>{h.text}</span>
                  <span className="muted small">{h.by} · {new Date(h.at).toLocaleString(config.locale.dateLocale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="stack">
          {(a.status === 'approved' || a.status === 'review' || a.status === 'applied' || a.status === 'enrolled') && (
            <Card title="Enrollment readiness">
              <ul className="checklist">
                {checks.map((c) => (
                  <li key={c.key} className={c.ok ? 'done' : ''}>
                    <span>{c.ok ? '✓' : c.blocking ? '✕' : '○'}</span>
                    <div><strong>{c.label}</strong><div className="muted small">{c.detail}</div></div>
                  </li>
                ))}
              </ul>
              {a.status !== 'enrolled' && a.status !== 'approved' && <p className="muted small">Approve the {t.application.toLowerCase()} to enable enrollment.</p>}
            </Card>
          )}

          <Card title={t.section}>
            {gradeSections.length === 0 ? (
              <p className="muted">No sections set up for {gradeName(config, a.gradeId)}. <Link to="/app/sections">Add sections</Link></p>
            ) : (
              <select value={a.sectionId} disabled={!can('sections.manage') || (a.status !== 'approved' && a.status !== 'enrolled')}
                onChange={async (e) => { const r = await d.assignSection(a.id, e.target.value); if (!r.ok) toast(r.error, 'error') }}>
                <option value="">Unassigned</option>
                {gradeSections.map((s) => {
                  const l = sectionLoad(s, applications.filter((x) => x.id !== a.id))
                  return <option key={s.id} value={s.id} disabled={l.full}>{s.name} — {l.used}/{s.capacity}{l.full ? ' (full)' : ''}</option>
                })}
              </select>
            )}
            {a.status !== 'approved' && a.status !== 'enrolled' && <p className="muted small">Sections can be assigned once approved.</p>}
          </Card>

          {can('payments.view') && (
            <Card title="Fees & payments" actions={can('payments.record') && (a.status === 'approved' || a.status === 'enrolled') ? <button className="btn primary" onClick={() => setPayOpen(true)}>Record payment</button> : undefined}>
              {optional.length > 0 && editable && (
                <div className="stack tight">
                  <strong className="small">Optional items</strong>
                  {optional.map((f) => (
                    <label key={f.id} className="check-row">
                      <input type="checkbox" checked={a.optionalFeeIds.includes(f.id)} onChange={() => d.updateApplication({ ...a, optionalFeeIds: toggle(a.optionalFeeIds, f.id) })} />
                      <span>{f.name}</span><span className="muted small">{money(config, f.amount)}</span>
                    </label>
                  ))}
                </div>
              )}
              <table className="table compact">
                <tbody>
                  {acct.assessment.items.map((i) => <tr key={i.id}><td>{i.name}</td><td className="right">{money(config, i.amount)}</td></tr>)}
                  {acct.assessment.discounts.map((x) => <tr key={x.id} className="good-text"><td>{x.name}</td><td className="right">−{money(config, x.amount)}</td></tr>)}
                  <tr className="total"><td>Net assessment</td><td className="right">{money(config, acct.assessment.total)}</td></tr>
                  <tr><td>Paid</td><td className="right">{money(config, acct.paid)}</td></tr>
                  <tr className="total"><td>Balance</td><td className="right">{money(config, acct.balance)}</td></tr>
                </tbody>
              </table>
              {config.discounts.length > 0 && editable && (
                <details>
                  <summary>Discounts & scholarships</summary>
                  <div className="stack tight">
                    {config.discounts.map((x) => (
                      <label key={x.id} className="check-row">
                        <input type="checkbox" checked={a.discountIds.includes(x.id)} onChange={() => d.updateApplication({ ...a, discountIds: toggle(a.discountIds, x.id) })} />
                        <span>{x.name}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
              {mine.length > 0 && (
                <>
                  <h3>Payments</h3>
                  <ul className="plain">
                    {mine.map((p) => (
                      <li key={p.id} className={`row between ${p.voided ? 'voided' : ''}`}>
                        <div><button className="link" onClick={() => setReceipt(p)}>{p.receiptNo}</button> <span className="muted small">{dateText(config, p.paidAt)} · {p.method}</span></div>
                        <div className="row gap"><strong>{money(config, p.amount)}</strong>{can('payments.void') && !p.voided && <button className="link danger-text" onClick={() => setVoiding(p)}>void</button>}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {can('applications.edit') && a.status !== 'enrolled' && (
            <button className="btn ghost danger-text" onClick={async () => { if (confirm(`Permanently delete ${fullName(a)} and their payments?`)) { await d.deleteApplication(a.id); nav('/app/applications') } }}>Delete record</button>
          )}
        </div>
      </div>

      {payOpen && <PaymentModal app={a} onClose={() => setPayOpen(false)} />}
      {receipt && <ReceiptModal payment={receipt} app={a} onClose={() => setReceipt(null)} />}
      {pending && (
        <Modal title={`${ACTION_LABEL[pending]} — ${fullName(a)}`} onClose={() => setPending(null)}>
          <form onSubmit={(e) => { e.preventDefault(); move(pending, reason.trim()) }} className="stack">
            <Field label="Reason (optional)"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
            <div className="row gap end"><button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button><button className="btn primary">Confirm</button></div>
          </form>
        </Modal>
      )}
      {voiding && (
        <Modal title={`Void ${voiding.receiptNo}`} onClose={() => setVoiding(null)}>
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (!voidReason.trim()) return; await d.voidPayment(voiding.id, voidReason.trim()); setVoiding(null); setVoidReason(''); toast('Receipt voided') }}>
            <p>The amount {money(config, voiding.amount)} will no longer count toward the balance. This is recorded in the history.</p>
            <Field label="Reason *"><input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus /></Field>
            <div className="row gap end"><button type="button" className="btn" onClick={() => setVoiding(null)}>Cancel</button><button className="btn danger">Void receipt</button></div>
          </form>
        </Modal>
      )}
    </>
  )
}
