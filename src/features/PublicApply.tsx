import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { emptyApplication, gradeName } from '../core/logic.ts'
import type { Application } from '../core/types.ts'
import { Card } from '../ui/kit.tsx'
import ApplicationForm from './ApplicationForm.tsx'

/** Parent-facing page: no sidebar, no staff data. */
export default function PublicApply({ embedded = false }: { embedded?: boolean }) {
  const { config, submitApplication } = useData()
  const [done, setDone] = useState<Application | null>(null)
  const t = config.terms

  if (done)
    return (
      <div className="narrow stack">
        <Card>
          <div className="success">
            <div className="check-big">✓</div>
            <h1>{t.application} received</h1>
            <p>Thank you! Please keep your reference number to track your {t.application.toLowerCase()}.</p>
            <div className="refno">{done.applicationNo}</div>
            <p className="muted">
              {done.firstName} {done.lastName} · {gradeName(config, done.gradeId)} · {config.schoolYears.find((s) => s.id === done.schoolYearId)?.name}
            </p>
            <p>Next: bring the required documents to the registrar's office. You can check what is still missing under <Link to="/track">Track {t.application.toLowerCase()}</Link> using the reference number and the {t.student.toLowerCase()}'s birth date.</p>
            <button className="btn" onClick={() => setDone(null)}>Submit another {t.application.toLowerCase()}</button>
          </div>
        </Card>
      </div>
    )

  return (
    <div className="narrow stack">
      {!embedded && <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
        <h1 style={{ fontSize: '2.4rem' }}>Apply to {config.school.name}</h1>
        <p className="muted">School year {config.schoolYears.find((s) => s.id === config.activeSchoolYearId)?.name}. It takes about 5 minutes. Fields marked * are required, and the registrar will contact you about next steps.</p>
      </div>}
      <ApplicationForm
        initial={emptyApplication(config)}
        submitLabel={`Submit ${t.application.toLowerCase()}`}
        onSubmit={async (a) => setDone(await submitApplication(a, 'online'))}
      />
    </div>
  )
}
