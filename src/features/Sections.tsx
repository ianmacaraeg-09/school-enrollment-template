import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { fullName, sectionLoad, uid } from '../core/logic.ts'
import type { Section } from '../core/types.ts'
import { Card, Empty, Field, Modal, PageHeader, ProgressBar } from '../ui/kit.tsx'

export default function Sections() {
  const d = useData()
  const { config, sections, applications, can, toast } = d
  const t = config.terms
  const [sy, setSy] = useState(config.activeSchoolYearId)
  const [edit, setEdit] = useState<Section | null>(null)
  const [view, setView] = useState<Section | null>(null)
  const manage = can('sections.manage')
  const unplaced = applications.filter((a) => a.schoolYearId === sy && a.status === 'approved' && !a.sectionId).length

  const blank = (gradeId: string): Section => ({ id: uid('sec'), schoolYearId: sy, gradeId, name: '', capacity: config.rules.defaultSectionCapacity, adviser: '', room: '' })

  return (
    <>
      <PageHeader title={`${t.section}s`} sub={`${sections.filter((s) => s.schoolYearId === sy).length} ${t.section.toLowerCase()}s in ${config.schoolYears.find((s) => s.id === sy)?.name ?? ''}`}>
        <select value={sy} onChange={(e) => setSy(e.target.value)} aria-label={t.schoolYear}>
          {config.schoolYears.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {manage && (
          <button className="btn" disabled={unplaced === 0} title="Places approved applicants into the least-full section of their grade"
            onClick={async () => { const n = await d.autoPlace(); toast(n ? `${n} placed automatically` : 'Nothing could be placed (no open seats)') }}>
            Auto-place approved ({unplaced})
          </button>
        )}
      </PageHeader>

      {config.levels.map((level) => (
        <Card key={level.id} title={level.name} pad={false}>
          {level.grades.map((g) => {
            const list = sections.filter((s) => s.gradeId === g.id && s.schoolYearId === sy)
            return (
              <div key={g.id} className="grade-block">
                <div className="row between">
                  <h3>{g.name}</h3>
                  {manage && <button className="btn ghost" onClick={() => setEdit(blank(g.id))}>+ Add {t.section.toLowerCase()}</button>}
                </div>
                {list.length === 0 ? (
                  <p className="muted small">No {t.section.toLowerCase()}s yet.</p>
                ) : (
                  <div className="section-grid">
                    {list.map((s) => {
                      const l = sectionLoad(s, applications)
                      return (
                        <div key={s.id} className="section-card">
                          <div className="row between">
                            <strong>{s.name}</strong>
                            <span className={`pill ${l.full ? 'bad' : 'good'}`}>{l.full ? 'Full' : `${l.free} open`}</span>
                          </div>
                          <ProgressBar value={l.used} max={s.capacity} />
                          <div className="muted small">{l.used}/{s.capacity} seats{s.adviser && ` · ${s.adviser}`}{s.room && ` · ${s.room}`}</div>
                          <div className="row gap">
                            <button className="link" onClick={() => setView(s)}>Class list</button>
                            {manage && <button className="link" onClick={() => setEdit(s)}>Edit</button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      ))}

      {edit && (
        <Modal title={sections.some((s) => s.id === edit.id) ? `Edit ${t.section.toLowerCase()}` : `New ${t.section.toLowerCase()}`} onClose={() => setEdit(null)}>
          <form className="grid" onSubmit={async (e) => { e.preventDefault(); if (!edit.name.trim()) return; await d.saveSection({ ...edit, capacity: Math.max(1, Number(edit.capacity) || 1) }); setEdit(null); toast('Saved') }}>
            <Field label="Name *"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <Field label="Capacity *"><input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></Field>
            <Field label="Adviser"><input value={edit.adviser} onChange={(e) => setEdit({ ...edit, adviser: e.target.value })} /></Field>
            <Field label="Room"><input value={edit.room} onChange={(e) => setEdit({ ...edit, room: e.target.value })} /></Field>
            <div className="span-all row between">
              {sections.some((s) => s.id === edit.id) ? (
                <button type="button" className="btn danger" onClick={async () => { const r = await d.deleteSection(edit.id); if (r.ok) { setEdit(null); toast('Deleted') } else toast(r.error, 'error') }}>Delete</button>
              ) : <span />}
              <div className="row gap"><button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary">Save</button></div>
            </div>
          </form>
        </Modal>
      )}

      {view && (
        <Modal title={`${view.name} — class list`} onClose={() => setView(null)}>
          {(() => {
            const list = applications.filter((a) => a.sectionId === view.id).sort((a, b) => a.lastName.localeCompare(b.lastName))
            return list.length === 0 ? <Empty title="No students placed yet" /> : (
              <ol className="plain numbered">
                {list.map((a) => <li key={a.id}><Link to={`/app/applications/${a.id}`}>{fullName(a)}</Link> <span className="muted small">{a.status === 'enrolled' ? 'enrolled' : 'reserved'}</span></li>)}
              </ol>
            )
          })()}
        </Modal>
      )}
    </>
  )
}
