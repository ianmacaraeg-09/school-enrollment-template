import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { dateText, gradeName, requirementProgress } from '../core/logic.ts'
import type { Application } from '../core/types.ts'
import { Card, Field, StatusBadge } from '../ui/kit.tsx'

/** Parent-facing status lookup. Needs the reference number AND the birth date. */
export default function Track({ embedded = false }: { embedded?: boolean }) {
  const { config, applications } = useData()
  const t = config.terms
  const [no, setNo] = useState('')
  const [dob, setDob] = useState('')
  const [result, setResult] = useState<Application | null | undefined>(undefined)

  const req = result ? requirementProgress(config, result) : null

  return (
    <div className="narrow stack">
      {!embedded && (
        <div>
          <h1>Track your {t.application.toLowerCase()}</h1>
          <p className="muted">Enter the reference number you received when you applied, and the {t.student.toLowerCase()}'s birth date.</p>
        </div>
      )}
      <Card>
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault()
            setResult(applications.find((a) => a.applicationNo.toLowerCase() === no.trim().toLowerCase() && a.birthDate === dob) ?? null)
          }}
        >
          <Field label="Reference number"><input value={no} onChange={(e) => setNo(e.target.value)} placeholder="APP-2026-0001" required /></Field>
          <Field label="Birth date"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required /></Field>
          <div className="row end"><button className="btn primary">Check status</button></div>
        </form>
      </Card>
      {result === null && <Card><p>No {t.application.toLowerCase()} matches those details. Please check the reference number and birth date.</p></Card>}
      {result && req && (
        <Card title={`${result.firstName} ${result.lastName}`} actions={<StatusBadge status={result.status} />}>
          <dl className="kv">
            <dt>Reference</dt><dd>{result.applicationNo}</dd>
            <dt>{t.gradeLevel}</dt><dd>{gradeName(config, result.gradeId)}</dd>
            <dt>Submitted</dt><dd>{dateText(config, result.createdAt)}</dd>
          </dl>
          <h3>Documents</h3>
          <ul className="checklist">
            {req.all.map((r) => (
              <li key={r.id} className={result.docs[r.id] ? 'done' : ''}>
                <span>{result.docs[r.id] ? '✓' : '○'}</span> {r.name} {!r.required && <em className="muted">(optional)</em>}
              </li>
            ))}
          </ul>
          {!req.complete && <p className="muted">Please submit the missing documents to the registrar's office.</p>}
        </Card>
      )}
    </div>
  )
}
