import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useData } from '../core/DataContext.tsx'
import { allGrades, uid } from '../core/logic.ts'
import type {
  AppStatus, CustomField, Discount, Fee, Landing, Level, Permission, Requirement, Role, SchoolConfig, SchoolYear, Track,
} from '../core/types.ts'
import { download } from '../ui/csv.ts'
import { Card, Field, PageHeader, Tabs } from '../ui/kit.tsx'

type Tab = 'school' | 'website' | 'terms' | 'years' | 'levels' | 'requirements' | 'fees' | 'fields' | 'rules' | 'roles' | 'data'
type Opt = { value: string; label: string }

interface Spec<T> {
  key: keyof T & string
  label: string
  kind: 'text' | 'number' | 'checkbox' | 'select' | 'chips' | 'date'
  options?: Opt[]
  hint?: string
  wide?: boolean
}

function ListEditor<T extends { id: string }>({ items, onChange, specs, blank, addLabel, title }: {
  items: T[]; onChange(next: T[]): void; specs: Spec<T>[]; blank(): T; addLabel: string; title(item: T, i: number): string
}) {
  const patch = (i: number, p: Partial<T>) => onChange(items.map((x, n) => (n === i ? { ...x, ...p } : x)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="stack">
      {items.map((item, i) => (
        <div key={item.id} className="edit-row">
          <div className="row between">
            <strong>{title(item, i) || `Item ${i + 1}`}</strong>
            <div className="row gap">
              <button className="btn ghost icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="btn ghost icon" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
              <button className="btn ghost icon danger-text" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">✕</button>
            </div>
          </div>
          <div className="grid">
            {specs.map((s) => {
              const v = item[s.key] as unknown
              if (s.kind === 'chips')
                return (
                  <div key={s.key} className={`field ${s.wide ? 'span-all' : ''}`}>
                    <span className="field-label">{s.label}</span>
                    <div className="chips">
                      {(s.options ?? []).map((o) => {
                        const on = (v as string[]).includes(o.value)
                        return (
                          <button key={o.value} type="button" className={`chip ${on ? 'on' : ''}`}
                            onClick={() => patch(i, { [s.key]: on ? (v as string[]).filter((x) => x !== o.value) : [...(v as string[]), o.value] } as Partial<T>)}>
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                    {s.hint && <span className="muted small">{s.hint}</span>}
                  </div>
                )
              return (
                <Field key={s.key} label={s.label} hint={s.hint} span={s.wide ? 'all' : undefined}>
                  {s.kind === 'checkbox' ? (
                    <span className="check-row"><input type="checkbox" checked={!!v} onChange={(e) => patch(i, { [s.key]: e.target.checked } as Partial<T>)} /><span>Yes</span></span>
                  ) : s.kind === 'select' ? (
                    <select value={String(v)} onChange={(e) => patch(i, { [s.key]: e.target.value } as Partial<T>)}>
                      {(s.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={s.kind} value={String(v ?? '')} onChange={(e) => patch(i, { [s.key]: s.kind === 'number' ? Number(e.target.value) : e.target.value } as Partial<T>)} />
                  )}
                </Field>
              )
            })}
          </div>
        </div>
      ))}
      <div><button className="btn" onClick={() => onChange([...items, blank()])}>+ {addLabel}</button></div>
    </div>
  )
}

export default function Settings() {
  const d = useData()
  const { config, hasOverride, toast } = d
  const [draft, setDraft] = useState<SchoolConfig>(config)
  const [tab, setTab] = useState<Tab>('school')
  const [errors, setErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const cfgRef = useRef<HTMLInputElement>(null)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config])
  const set = <K extends keyof SchoolConfig>(k: K, v: SchoolConfig[K]) => setDraft((p) => ({ ...p, [k]: v }))
  const levelOpts: Opt[] = draft.levels.map((l) => ({ value: l.id, label: l.name }))
  const gradeOpts: Opt[] = allGrades(draft).map((g) => ({ value: g.id, label: g.name }))

  async function save() {
    const problems: string[] = []
    if (!draft.school.name.trim()) problems.push('School name is required.')
    if (!draft.schoolYears.some((s) => s.id === draft.activeSchoolYearId)) problems.push('Choose an active school year that exists.')
    if (draft.levels.some((l) => !l.name.trim() || l.grades.length === 0 || l.grades.some((g) => !g.name.trim()))) problems.push('Every level needs a name and at least one named grade.')
    const gradesKept = new Set(allGrades(draft).map((g) => g.id))
    const orphanGrades = [...new Set(d.applications.map((a) => a.gradeId))].filter((g) => !gradesKept.has(g))
    if (orphanGrades.length) problems.push('A grade that still has applications was removed. Put it back (rename it instead).')
    const yearsKept = new Set(draft.schoolYears.map((s) => s.id))
    if (d.applications.some((a) => !yearsKept.has(a.schoolYearId))) problems.push('A school year that still has applications was removed.')
    if (draft.paymentMethods.length === 0) problems.push('Add at least one payment method.')
    const hasSeq = (f: string) => /\{SEQ(:\d+)?\}/.test(f)
    if (![draft.rules.studentNoFormat, draft.rules.applicationNoFormat, draft.rules.receiptNoFormat].every(hasSeq))
      problems.push('Each numbering format must contain {SEQ} or {SEQ:5}, otherwise numbers would repeat.')
    setErrors(problems)
    if (problems.length) return toast('Fix the highlighted problems first', 'error')
    await d.saveSettings(draft)
    toast('Settings saved')
  }

  const terms = Object.keys(draft.terms) as (keyof SchoolConfig['terms'])[]
  const TERM_LABEL: Record<string, string> = { student: 'Student (singular)', students: 'Students (plural)', guardian: 'Parent / guardian', gradeLevel: 'Grade level', section: 'Section / class', track: 'Track / strand', application: 'Application', schoolYear: 'School year' }
  const stud: Opt[] = [{ value: 'new', label: 'New' }, { value: 'transferee', label: 'Transferee' }, { value: 'returning', label: 'Returning' }]
  const permissions: Permission[] = ['applications.view', 'applications.edit', 'applications.review', 'applications.enroll', 'sections.manage', 'payments.view', 'payments.record', 'payments.void', 'reports.view', 'settings.edit']

  let body: ReactNode
  switch (tab) {
    case 'school':
      body = (
        <Card title="School profile & branding">
          <div className="grid">
            <Field label="School name *"><input value={draft.school.name} onChange={(e) => set('school', { ...draft.school, name: e.target.value })} /></Field>
            <Field label="Short name"><input value={draft.school.shortName} onChange={(e) => set('school', { ...draft.school, shortName: e.target.value })} /></Field>
            <Field label="Tagline" span="all"><input value={draft.school.tagline} onChange={(e) => set('school', { ...draft.school, tagline: e.target.value })} /></Field>
            <Field label="Address" span="all"><input value={draft.school.address} onChange={(e) => set('school', { ...draft.school, address: e.target.value })} /></Field>
            <Field label="Phone"><input value={draft.school.phone} onChange={(e) => set('school', { ...draft.school, phone: e.target.value })} /></Field>
            <Field label="Email"><input value={draft.school.email} onChange={(e) => set('school', { ...draft.school, email: e.target.value })} /></Field>
            <Field label="Logo initials" hint="1–3 letters shown in the logo badge"><input maxLength={3} value={draft.school.logoText} onChange={(e) => set('school', { ...draft.school, logoText: e.target.value })} /></Field>
            <Field label="Primary colour"><input type="color" value={draft.theme.primary} onChange={(e) => set('theme', { ...draft.theme, primary: e.target.value })} /></Field>
            <Field label="Accent colour"><input type="color" value={draft.theme.accent} onChange={(e) => set('theme', { ...draft.theme, accent: e.target.value })} /></Field>
            <Field label="Currency symbol"><input maxLength={4} value={draft.locale.currencySymbol} onChange={(e) => set('locale', { ...draft.locale, currencySymbol: e.target.value })} /></Field>
            <Field label="Date/number locale" hint="e.g. en-PH, en-US, en-GB"><input value={draft.locale.dateLocale} onChange={(e) => set('locale', { ...draft.locale, dateLocale: e.target.value })} /></Field>
          </div>
        </Card>
      )
      break
    case 'terms':
      body = (
        <Card title="Terminology">
          <p className="muted">Rename labels to match how this school talks (e.g. “Learner”, “Pupil”, “Year level”, “Class”).</p>
          <div className="grid">
            {terms.map((k) => <Field key={k} label={TERM_LABEL[k]}><input value={draft.terms[k]} onChange={(e) => set('terms', { ...draft.terms, [k]: e.target.value })} /></Field>)}
          </div>
          <h3>Status names</h3>
          <div className="grid">
            {(Object.keys(draft.statusLabels) as AppStatus[]).map((s) => (
              <Field key={s} label={`“${s}” shown as`}><input value={draft.statusLabels[s]} onChange={(e) => set('statusLabels', { ...draft.statusLabels, [s]: e.target.value })} /></Field>
            ))}
          </div>
        </Card>
      )
      break
    case 'years':
      body = (
        <Card title="School years">
          <Field label="Currently enrolling for"><select value={draft.activeSchoolYearId} onChange={(e) => set('activeSchoolYearId', e.target.value)}>{draft.schoolYears.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <ListEditor<SchoolYear> items={draft.schoolYears} onChange={(v) => set('schoolYears', v)} addLabel="Add school year" title={(s) => s.name}
            blank={() => ({ id: uid('sy'), name: '', startDate: '', endDate: '' })}
            specs={[{ key: 'name', label: 'Name', kind: 'text' }, { key: 'startDate', label: 'Starts', kind: 'date' }, { key: 'endDate', label: 'Ends', kind: 'date' }]} />
        </Card>
      )
      break
    case 'levels':
      body = (
        <div className="stack">
          <Card title="Levels & grades">
            <p className="muted">Group grades into levels (Preschool, Elementary, College…). Fees and requirements can be set per level.</p>
            <div className="stack">
              {draft.levels.map((l, li) => (
                <div key={l.id} className="edit-row">
                  <div className="row gap">
                    <input className="grow" value={l.name} aria-label="Level name" onChange={(e) => set('levels', draft.levels.map((x, n) => (n === li ? { ...x, name: e.target.value } : x)))} />
                    <button className="btn ghost danger-text" onClick={() => set('levels', draft.levels.filter((_, n) => n !== li))}>Remove level</button>
                  </div>
                  <div className="chips">
                    {l.grades.map((g, gi) => (
                      <span key={g.id} className="chip-edit">
                        <input value={g.name} aria-label="Grade name" onChange={(e) => set('levels', draft.levels.map((x, n) => (n === li ? { ...x, grades: x.grades.map((y, m) => (m === gi ? { ...y, name: e.target.value } : y)) } : x)))} />
                        <button className="link danger-text" aria-label="Remove grade" onClick={() => set('levels', draft.levels.map((x, n) => (n === li ? { ...x, grades: x.grades.filter((_, m) => m !== gi) } : x)))}>✕</button>
                      </span>
                    ))}
                    <button className="btn" onClick={() => set('levels', draft.levels.map((x, n) => (n === li ? { ...x, grades: [...x.grades, { id: uid('g'), name: `Grade ${x.grades.length + 1}` }] } : x)))}>+ Grade</button>
                  </div>
                </div>
              ))}
              <div><button className="btn" onClick={() => set('levels', [...draft.levels, { id: uid('lvl'), name: 'New level', grades: [{ id: uid('g'), name: 'Grade 1' }] } as Level])}>+ Add level</button></div>
            </div>
          </Card>
          <Card title="Tracks / strands / programs">
            <p className="muted">Optional. Applicants must pick one when they apply to the grades selected here (e.g. SHS strands, college programs).</p>
            <ListEditor<Track> items={draft.tracks} onChange={(v) => set('tracks', v)} addLabel="Add track" title={(x) => x.name}
              blank={() => ({ id: uid('trk'), name: '', gradeIds: [] })}
              specs={[{ key: 'name', label: 'Name', kind: 'text' }, { key: 'gradeIds', label: 'Offered in', kind: 'chips', options: gradeOpts, wide: true }]} />
          </Card>
        </div>
      )
      break
    case 'requirements':
      body = (
        <Card title="Required documents">
          <p className="muted">Leave “Applies to levels” / “Student types” empty to apply to everyone.</p>
          <ListEditor<Requirement> items={draft.requirements} onChange={(v) => set('requirements', v)} addLabel="Add requirement" title={(x) => x.name}
            blank={() => ({ id: uid('req'), name: '', required: true, levelIds: [], studentTypes: [] })}
            specs={[
              { key: 'name', label: 'Document', kind: 'text' }, { key: 'required', label: 'Mandatory', kind: 'checkbox' },
              { key: 'levelIds', label: 'Applies to levels', kind: 'chips', options: levelOpts, wide: true },
              { key: 'studentTypes', label: 'Student types', kind: 'chips', options: stud, wide: true },
            ] as Spec<Requirement>[]} />
        </Card>
      )
      break
    case 'fees':
      body = (
        <div className="stack">
          <Card title="Fee schedule">
            <p className="muted">Each fee applies to the levels you tick (none ticked = all levels). “Optional” fees are chosen per student. Percentage discounts only reduce “Discountable” fees, usually tuition.</p>
            <ListEditor<Fee> items={draft.fees} onChange={(v) => set('fees', v)} addLabel="Add fee" title={(x) => `${x.name} — ${x.amount.toLocaleString()}`}
              blank={() => ({ id: uid('fee'), name: '', amount: 0, levelIds: [], optional: false, discountable: false })}
              specs={[
                { key: 'name', label: 'Fee name', kind: 'text' }, { key: 'amount', label: 'Amount', kind: 'number' },
                { key: 'optional', label: 'Optional', kind: 'checkbox' }, { key: 'discountable', label: 'Discountable', kind: 'checkbox' },
                { key: 'levelIds', label: 'Applies to levels', kind: 'chips', options: levelOpts, wide: true },
              ] as Spec<Fee>[]} />
          </Card>
          <Card title="Discounts & scholarships">
            <ListEditor<Discount> items={draft.discounts} onChange={(v) => set('discounts', v)} addLabel="Add discount" title={(x) => x.name}
              blank={() => ({ id: uid('disc'), name: '', kind: 'percent', value: 10 })}
              specs={[
                { key: 'name', label: 'Name', kind: 'text' },
                { key: 'kind', label: 'Type', kind: 'select', options: [{ value: 'percent', label: 'Percent of discountable fees' }, { value: 'fixed', label: 'Fixed amount' }] },
                { key: 'value', label: 'Value', kind: 'number' },
              ]} />
          </Card>
          <Card title="Payment methods">
            <Field label="One per line" hint="Shown in the Record payment form">
              <textarea rows={4} value={draft.paymentMethods.join('\n')} onChange={(e) => set('paymentMethods', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />
            </Field>
          </Card>
        </div>
      )
      break
    case 'fields':
      body = (
        <Card title="Custom application fields">
          <p className="muted">Extra questions on the application form. For dropdowns, type the choices separated by commas.</p>
          <ListEditor<CustomField> items={draft.customFields} onChange={(v) => set('customFields', v)} addLabel="Add field" title={(x) => x.label}
            blank={() => ({ id: uid('cf'), label: '', type: 'text', options: '', required: false, group: 'extra', levelIds: [] })}
            specs={[
              { key: 'label', label: 'Question', kind: 'text', wide: true },
              { key: 'type', label: 'Answer type', kind: 'select', options: ['text', 'textarea', 'number', 'date', 'select', 'checkbox'].map((v) => ({ value: v, label: v })) },
              { key: 'group', label: 'Section of form', kind: 'select', options: [{ value: 'student', label: 'Student information' }, { value: 'guardian', label: 'Parent / guardian' }, { value: 'extra', label: 'Additional information' }] },
              { key: 'options', label: 'Dropdown choices', kind: 'text', hint: 'Only for “select”', wide: true },
              { key: 'required', label: 'Required', kind: 'checkbox' },
              { key: 'levelIds', label: 'Show for levels', kind: 'chips', options: levelOpts, wide: true },
            ] as Spec<CustomField>[]} />
        </Card>
      )
      break
    case 'website': {
      const L = draft.landing
      const setL = (p: Partial<typeof L>) => set('landing', { ...L, ...p })
      body = (
        <div className="stack">
          <Card title="Home page text">
            <p className="muted">This is the public website parents see first. Fees, requirements, levels and the application form are filled in automatically from the other tabs.</p>
            <div className="grid">
              <Field label="Headline" span="all"><input value={L.heroTitle} onChange={(e) => setL({ heroTitle: e.target.value })} /></Field>
              <Field label="Short intro under the headline" span="all"><textarea rows={3} value={L.heroText} onChange={(e) => setL({ heroText: e.target.value })} /></Field>
              <Field label="About the school" span="all"><textarea rows={4} value={L.about} onChange={(e) => setL({ about: e.target.value })} /></Field>
              <Field label="Office hours" span="all"><input value={L.officeHours} onChange={(e) => setL({ officeHours: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Key numbers">
            <ListEditor<Landing['stats'][number]> items={L.stats} onChange={(v) => setL({ stats: v })} addLabel="Add a number" title={(x) => `${x.value} ${x.label}`}
              blank={() => ({ id: uid('st'), value: '', label: '' })}
              specs={[{ key: 'value', label: 'Number', kind: 'text', hint: 'e.g. 20+ or 98%' }, { key: 'label', label: 'What it means', kind: 'text' }]} />
          </Card>
          <Card title="Why families choose us">
            <ListEditor<Landing['highlights'][number]> items={L.highlights} onChange={(v) => setL({ highlights: v })} addLabel="Add a highlight" title={(x) => x.title}
              blank={() => ({ id: uid('hl'), title: '', text: '' })}
              specs={[{ key: 'title', label: 'Title', kind: 'text' }, { key: 'text', label: 'Short description', kind: 'text', wide: true }]} />
          </Card>
          <Card title="Frequently asked questions">
            <ListEditor<Landing['faqs'][number]> items={L.faqs} onChange={(v) => setL({ faqs: v })} addLabel="Add a question" title={(x) => x.q}
              blank={() => ({ id: uid('fq'), q: '', a: '' })}
              specs={[{ key: 'q', label: 'Question', kind: 'text', wide: true }, { key: 'a', label: 'Answer', kind: 'text', wide: true }]} />
          </Card>
        </div>
      )
      break
    }
    case 'rules':
      body = (
        <Card title="Enrollment rules & numbering">
          <div className="grid">
            <Field label="Minimum down payment (%)" hint="0 turns the rule off"><input type="number" min={0} max={100} value={draft.rules.minDownpaymentPercent} onChange={(e) => set('rules', { ...draft.rules, minDownpaymentPercent: Number(e.target.value) })} /></Field>
            <Field label="Default section capacity"><input type="number" min={1} value={draft.rules.defaultSectionCapacity} onChange={(e) => set('rules', { ...draft.rules, defaultSectionCapacity: Number(e.target.value) })} /></Field>
            <Field label="Require all mandatory documents to enroll"><span className="check-row"><input type="checkbox" checked={draft.rules.requireDocsToEnroll} onChange={(e) => set('rules', { ...draft.rules, requireDocsToEnroll: e.target.checked })} /><span>Yes</span></span></Field>
            <Field label="Require a section to enroll"><span className="check-row"><input type="checkbox" checked={draft.rules.requireSectionToEnroll} onChange={(e) => set('rules', { ...draft.rules, requireSectionToEnroll: e.target.checked })} /><span>Yes</span></span></Field>
            <Field label="Online application & tracking pages"><span className="check-row"><input type="checkbox" checked={draft.rules.onlineApplication} onChange={(e) => set('rules', { ...draft.rules, onlineApplication: e.target.checked })} /><span>Enabled</span></span></Field>
            <Field label="Student number format" hint="{YYYY} year, {SEQ:5} 5-digit counter"><input value={draft.rules.studentNoFormat} onChange={(e) => set('rules', { ...draft.rules, studentNoFormat: e.target.value })} /></Field>
            <Field label="Application number format"><input value={draft.rules.applicationNoFormat} onChange={(e) => set('rules', { ...draft.rules, applicationNoFormat: e.target.value })} /></Field>
            <Field label="Receipt number format"><input value={draft.rules.receiptNoFormat} onChange={(e) => set('rules', { ...draft.rules, receiptNoFormat: e.target.value })} /></Field>
          </div>
        </Card>
      )
      break
    case 'roles':
      body = (
        <Card title="Roles & permissions">
          <p className="muted">What each role can do. With a real backend these map to user accounts (see docs/BACKEND.md). The “Viewing as” switcher in the sidebar is for demos only.</p>
          <div className="table-wrap"><table className="table compact">
            <thead><tr><th>Permission</th>{(['admin', 'registrar', 'cashier'] as Role[]).map((r) => <th key={r} className="center cap-first">{r}</th>)}</tr></thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p}>
                  <td><code>{p}</code></td>
                  {(['admin', 'registrar', 'cashier'] as Role[]).map((r) => (
                    <td key={r} className="center">
                      <input type="checkbox" aria-label={`${r} ${p}`} checked={draft.roles[r].includes(p)} disabled={r === 'admin' && p === 'settings.edit'}
                        onChange={(e) => set('roles', { ...draft.roles, [r]: e.target.checked ? [...draft.roles[r], p] : draft.roles[r].filter((x) => x !== p) })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )
      break
    case 'data':
      body = (
        <div className="stack">
          <Card title="Carry this setup to another client">
            <p className="muted">Download everything on the previous tabs as a ready-to-paste <code>school.config.ts</code> so the template ships with this school's setup as its new default. Save your changes first.</p>
            <div className="row gap wrap">
              <button className="btn primary" onClick={() => download('school.config.ts', `// Generated from Settings on ${new Date().toISOString().slice(0, 10)}\nimport type { SchoolConfig } from '../core/types.ts'\n\nexport const defaultConfig: SchoolConfig = ${JSON.stringify(config, null, 2)}\n`, 'text/plain')}>Download school.config.ts</button>
              <button className="btn" onClick={() => download('school-settings.json', JSON.stringify(config, null, 2), 'application/json')}>Export settings (JSON)</button>
              <button className="btn" onClick={() => cfgRef.current?.click()}>Import settings (JSON)</button>
              <input ref={cfgRef} type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f) return
                try {
                  const parsed = JSON.parse(await f.text()) as SchoolConfig
                  if (!parsed.school || !Array.isArray(parsed.levels)) throw new Error()
                  setDraft(parsed); toast('Imported into the editor — review, then Save changes')
                } catch { toast('That file is not a settings export', 'error') }
              }} />
            </div>
            {hasOverride && <p><button className="link danger-text" onClick={async () => { if (confirm('Discard all Settings edits and go back to school.config.ts?')) { await d.resetSettings(); toast('Settings reset to file defaults'); setTimeout(() => location.reload(), 500) } }}>Reset all settings to the defaults in school.config.ts</button></p>}
          </Card>
          <Card title="Records">
            <div className="row gap wrap">
              <button className="btn" onClick={() => download(`enrollment-data-${new Date().toISOString().slice(0, 10)}.json`, d.exportJson(), 'application/json')}>Backup all data (JSON)</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f || !confirm('Restoring replaces ALL current records. Continue?')) return
                const r = await d.importJson(await f.text()); toast(r.ok ? 'Backup restored' : r.error, r.ok ? 'ok' : 'error')
              }} />
              <button className="btn" onClick={async () => { if (!d.applications.length || confirm('Replace current records with sample data?')) { await d.loadDemo(); toast('Sample data loaded') } }}>Load sample data</button>
              <button className="btn danger" onClick={async () => { if (confirm('Delete ALL applications, payments and sections? Settings are kept. This cannot be undone.')) { await d.clearData(); toast('All records cleared') } }}>Clear all records</button>
            </div>
            <p className="muted small">Records currently held: {d.applications.length} applications, {d.payments.length} payments, {d.sections.length} sections. {d.backend === 'local' ? 'Stored in this browser only — back up regularly until a server backend is connected.' : ''}</p>
          </Card>
        </div>
      )
      break
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'school', label: 'School' }, { id: 'website', label: 'Website' }, { id: 'terms', label: 'Terminology' }, { id: 'years', label: 'School years' }, { id: 'levels', label: 'Levels & grades' },
    { id: 'requirements', label: 'Requirements' }, { id: 'fees', label: 'Fees' }, { id: 'fields', label: 'Form fields' }, { id: 'rules', label: 'Rules' },
    { id: 'roles', label: 'Roles' }, { id: 'data', label: 'Data' },
  ]

  return (
    <>
      <PageHeader title="Settings" sub="Everything here is per-school. No code changes needed.">
        {dirty && <button className="btn" onClick={() => { setDraft(config); setErrors([]) }}>Discard</button>}
        <button className="btn primary" onClick={save} disabled={!dirty}>Save changes</button>
      </PageHeader>
      {errors.length > 0 && <div className="alert error"><strong>Can't save yet</strong><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      {body}
      {dirty && tab !== 'data' && <p className="muted small">You have unsaved changes.</p>}
    </>
  )
}
