import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { customFieldsFor, tracksFor, validateApplication } from '../core/logic.ts'
import type { Application, CustomField } from '../core/types.ts'
import { Card, Field } from '../ui/kit.tsx'

function CustomInput({ f, value, onChange }: { f: CustomField; value: Application['custom'][string] | undefined; onChange(v: string | boolean): void }) {
  if (f.type === 'textarea') return <textarea rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
  if (f.type === 'select')
    return (
      <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {f.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}
      </select>
    )
  if (f.type === 'checkbox')
    return (
      <span className="check-row">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>Yes</span>
      </span>
    )
  return <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
}

/** Used by both the staff editor and the public application page. */
export default function ApplicationForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Application
  submitLabel: string
  onSubmit(a: Application): void | Promise<void>
  onCancel?(): void
}) {
  const { config } = useData()
  const t = config.terms
  const [a, setA] = useState<Application>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Application>(k: K, v: Application[K]) => setA((p) => ({ ...p, [k]: v }))
  const setG = (k: keyof Application['guardian'], v: string) => setA((p) => ({ ...p, guardian: { ...p.guardian, [k]: v } }))
  const setC = (id: string, v: string | boolean) => setA((p) => ({ ...p, custom: { ...p.custom, [id]: v } }))
  const err = (k: string) => errors[k]
  const tracks = tracksFor(config, a.gradeId)
  const customs = customFieldsFor(config, a.gradeId)
  const group = (g: CustomField['group']) => customs.filter((f) => f.group === g)

  const renderCustom = (g: CustomField['group']) =>
    group(g).map((f) => (
      <Field key={f.id} label={f.label + (f.required && f.type !== 'checkbox' ? ' *' : '')} error={err(`custom:${f.id}`)} span={f.type === 'textarea' || f.type === 'checkbox' ? 'all' : undefined}>
        <CustomInput f={f} value={a.custom[f.id]} onChange={(v) => setC(f.id, v)} />
      </Field>
    ))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const found = validateApplication(config, a)
    setErrors(found)
    if (Object.keys(found).length) {
      document.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    try {
      await onSubmit(a)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      <Card title={`${t.schoolYear} & ${t.gradeLevel}`}>
        <div className="grid">
          <Field label={`${t.schoolYear} *`}>
            <select value={a.schoolYearId} onChange={(e) => set('schoolYearId', e.target.value)}>
              {config.schoolYears.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={`${t.gradeLevel} *`} error={err('gradeId')}>
            <select value={a.gradeId} onChange={(e) => setA((p) => ({ ...p, gradeId: e.target.value, trackId: '', optionalFeeIds: [] }))}>
              <option value="">Select…</option>
              {config.levels.map((l) => (
                <optgroup key={l.id} label={l.name}>
                  {l.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          {tracks.length > 0 && (
            <Field label={`${t.track} *`} error={err('trackId')}>
              <select value={a.trackId} onChange={(e) => set('trackId', e.target.value)}>
                <option value="">Select…</option>
                {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={`${t.student} type *`}>
            <select value={a.studentType} onChange={(e) => set('studentType', e.target.value as Application['studentType'])}>
              <option value="new">New</option>
              <option value="transferee">Transferee</option>
              <option value="returning">Returning / continuing</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title={`${t.student} information`}>
        <div className="grid">
          <Field label="First name *" error={err('firstName')}><input value={a.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" /></Field>
          <Field label="Middle name"><input value={a.middleName} onChange={(e) => set('middleName', e.target.value)} /></Field>
          <Field label="Last name *" error={err('lastName')}><input value={a.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" /></Field>
          <Field label="Birth date *" error={err('birthDate')}><input type="date" value={a.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
          <Field label="Sex *" error={err('sex')}>
            <select value={a.sex} onChange={(e) => set('sex', e.target.value as Application['sex'])}>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </Field>
          <Field label="Previous school" hint={a.studentType === 'new' ? 'Leave blank if none' : undefined}><input value={a.previousSchool} onChange={(e) => set('previousSchool', e.target.value)} /></Field>
          <Field label="Home address *" error={err('address')} span="all"><input value={a.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" /></Field>
          {renderCustom('student')}
        </div>
      </Card>

      <Card title={t.guardian}>
        <div className="grid">
          <Field label="Full name *" error={err('guardianName')}><input value={a.guardian.name} onChange={(e) => setG('name', e.target.value)} /></Field>
          <Field label="Relationship"><input value={a.guardian.relationship} onChange={(e) => setG('relationship', e.target.value)} placeholder="Mother, Father, Aunt…" /></Field>
          <Field label="Mobile number *" error={err('guardianPhone')}><input type="tel" value={a.guardian.phone} onChange={(e) => setG('phone', e.target.value)} autoComplete="tel" /></Field>
          <Field label="Email" error={err('guardianEmail')}><input type="email" value={a.guardian.email} onChange={(e) => setG('email', e.target.value)} autoComplete="email" /></Field>
          <Field label="Occupation"><input value={a.guardian.occupation} onChange={(e) => setG('occupation', e.target.value)} /></Field>
          {renderCustom('guardian')}
        </div>
      </Card>

      {group('extra').length > 0 && (
        <Card title="Additional information">
          <div className="grid">{renderCustom('extra')}</div>
        </Card>
      )}

      <div className="row gap end sticky-actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  )
}
