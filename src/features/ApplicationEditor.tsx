import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { emptyApplication } from '../core/logic.ts'
import { Card, PageHeader } from '../ui/kit.tsx'
import ApplicationForm from './ApplicationForm.tsx'

/** Staff: create a walk-in application, or edit an existing one. */
export default function ApplicationEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { config, applications, submitApplication, updateApplication, toast } = useData()
  const existing = id ? applications.find((a) => a.id === id) : undefined
  const t = config.terms

  if (id && !existing) return <Card title="Not found"><p>That {t.application.toLowerCase()} no longer exists.</p></Card>

  return (
    <>
      <PageHeader title={existing ? `Edit ${t.application.toLowerCase()} ${existing.applicationNo}` : `New ${t.application.toLowerCase()} (walk-in)`} sub={existing ? undefined : 'Encode an application received at the registrar\'s office.'} />
      <ApplicationForm
        initial={existing ?? emptyApplication(config)}
        submitLabel={existing ? 'Save changes' : `Submit ${t.application.toLowerCase()}`}
        onCancel={() => nav(-1)}
        onSubmit={async (a) => {
          if (existing) {
            await updateApplication(a)
            toast('Changes saved')
            nav(`/app/applications/${existing.id}`)
          } else {
            const created = await submitApplication(a, 'walk-in')
            toast(`${created.applicationNo} created`)
            nav(`/app/applications/${created.id}`)
          }
        }}
      />
    </>
  )
}
