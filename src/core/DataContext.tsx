import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultConfig, demoMode } from '../config/school.config.ts'
import { canEnroll, enrollmentReadiness, formatNumber, holdsSeat, roleCan, schoolYearStart, sectionLoad, transitions, uid } from './logic.ts'
import { buildDemoData } from './seed.ts'
import { backendKind, repository } from './storage/index.ts'
import { emptySnapshot } from './storage/repository.ts'
import type { AppStatus, Application, DataSnapshot, HistoryEntry, Payment, Permission, Role, SchoolConfig, Section } from './types.ts'

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (error: string): Result<never> => ({ ok: false, error })

export interface Toast { id: number; kind: 'ok' | 'error'; text: string }

export interface PaymentInput {
  applicationId: string
  amount: number
  method: string
  reference: string
  note: string
  paidAt: string
}

interface Ctx {
  ready: boolean
  backend: 'local' | 'supabase'
  config: SchoolConfig
  hasOverride: boolean
  applications: Application[]
  payments: Payment[]
  sections: Section[]
  role: Role
  setRole(r: Role): void
  can(p: Permission): boolean
  actor: string
  toasts: Toast[]
  toast(text: string, kind?: Toast['kind']): void

  submitApplication(a: Application, source: Application['source']): Promise<Application>
  updateApplication(a: Application): Promise<void>
  deleteApplication(id: string): Promise<void>
  changeStatus(id: string, to: AppStatus, note?: string): Promise<Result>
  assignSection(id: string, sectionId: string): Promise<Result>
  autoPlace(): Promise<number>
  addNote(id: string, text: string): Promise<void>
  recordPayment(input: PaymentInput): Promise<Result<Payment>>
  voidPayment(id: string, reason: string): Promise<void>
  saveSection(s: Section): Promise<void>
  deleteSection(id: string): Promise<Result>

  saveSettings(c: SchoolConfig): Promise<void>
  resetSettings(): Promise<void>
  loadDemo(): Promise<void>
  clearData(): Promise<void>
  exportJson(): string
  importJson(text: string): Promise<Result>
}

const DataCtx = createContext<Ctx | null>(null)
export function useData() {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData must be used inside <DataProvider>')
  return c
}

const roleKey = `school-enrollment:v1:${defaultConfig.storageNamespace}:role`
const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', registrar: 'Registrar', cashier: 'Cashier' }

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<DataSnapshot>(emptySnapshot())
  const ref = useRef<DataSnapshot>(snap)
  const [ready, setReady] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [role, setRoleState] = useState<Role>(() => {
    try {
      const r = localStorage.getItem(roleKey)
      if (r === 'admin' || r === 'registrar' || r === 'cashier') return r
    } catch { /* ignore */ }
    return 'admin'
  })

  const commit = useCallback((next: DataSnapshot) => {
    ref.current = next
    setSnap(next)
  }, [])

  useEffect(() => {
    repository.load().then(async (s) => {
      // Demo mode: first visit starts with realistic sample data (once; "Clear data" stays cleared).
      const seedKey = `${defaultConfig.storageNamespace}:demo-seeded`
      let seeded = false
      try { seeded = localStorage.getItem(seedKey) === '1' } catch { /* ignore */ }
      if (demoMode && !seeded && backendKind === 'local' && s.applications.length === 0) {
        const demo = buildDemoData(s.settings ? { ...defaultConfig, ...s.settings } : defaultConfig)
        await repository.replaceAll(demo)
        s = demo
      }
      try { localStorage.setItem(seedKey, '1') } catch { /* ignore */ }
      commit(s)
      setReady(true)
    })
  }, [commit])

  const config = useMemo<SchoolConfig>(() => (snap.settings ? { ...defaultConfig, ...snap.settings } : defaultConfig), [snap.settings])

  // Apply theme + title whenever the config changes.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--primary', config.theme.primary)
    root.setProperty('--accent', config.theme.accent)
    document.title = `${config.school.shortName} — Enrollment`
  }, [config])

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const setRole = (r: Role) => {
    setRoleState(r)
    try { localStorage.setItem(roleKey, r) } catch { /* ignore */ }
  }
  const actor = ROLE_LABEL[role]
  const can = useCallback((p: Permission) => roleCan(config, role, p), [config, role])

  const entry = (kind: HistoryEntry['kind'], text: string, by = actor): HistoryEntry => ({ id: uid('h'), at: new Date().toISOString(), by, kind, text })

  const saveApp = async (a: Application) => {
    const next = { ...a, updatedAt: new Date().toISOString() }
    await repository.saveApplication(next)
    const s = ref.current
    const exists = s.applications.some((x) => x.id === next.id)
    commit({ ...s, applications: exists ? s.applications.map((x) => (x.id === next.id ? next : x)) : [...s.applications, next] })
    return next
  }
  const find = (id: string) => ref.current.applications.find((a) => a.id === id)

  const value: Ctx = {
    ready,
    backend: backendKind,
    config,
    hasOverride: snap.settings !== null,
    applications: snap.applications,
    payments: snap.payments,
    sections: snap.sections,
    role,
    setRole,
    can,
    actor,
    toasts,
    toast,

    async submitApplication(a, source) {
      const n = await repository.nextCounter('application')
      const year = schoolYearStart(config, a.schoolYearId)
      const created: Application = {
        ...a,
        id: uid('app'),
        applicationNo: formatNumber(config.rules.applicationNoFormat, year, n),
        status: 'applied',
        source,
        createdAt: new Date().toISOString(),
        history: [entry('system', 'Application submitted', source === 'online' ? 'Online applicant' : actor)],
      }
      commit({ ...ref.current, counters: { ...ref.current.counters, application: n } })
      return saveApp(created)
    },

    async updateApplication(a) {
      await saveApp(a)
    },

    async deleteApplication(id) {
      await repository.deleteApplication(id)
      const s = ref.current
      commit({ ...s, applications: s.applications.filter((a) => a.id !== id), payments: s.payments.filter((p) => p.applicationId !== id) })
    },

    async changeStatus(id, to, note) {
      const a = find(id)
      if (!a) return fail('Application not found')
      if (!transitions[a.status].includes(to)) return fail(`Cannot move from ${config.statusLabels[a.status]} to ${config.statusLabels[to]}`)
      if (to === 'enrolled') {
        if (!can('applications.enroll')) return fail('Your role cannot enroll students')
        const checks = enrollmentReadiness(config, a, ref.current.payments)
        if (!canEnroll(checks)) return fail(checks.filter((c) => !c.ok && c.blocking).map((c) => c.detail).join(' · '))
      }
      let studentNo = a.studentNo
      const history = [...a.history]
      if (to === 'enrolled' && !studentNo) {
        const n = await repository.nextCounter('student')
        studentNo = formatNumber(config.rules.studentNoFormat, schoolYearStart(config, a.schoolYearId), n)
        commit({ ...ref.current, counters: { ...ref.current.counters, student: n } })
        history.push(entry('system', `Student number ${studentNo} issued`))
      }
      // leaving a seat-holding status frees nothing automatically; declined/withdrawn release the section
      const releasesSeat = holdsSeat(a.status) && !holdsSeat(to)
      history.push(entry('status', `Status changed to ${config.statusLabels[to]}${note ? ` — ${note}` : ''}`))
      await saveApp({ ...a, status: to, studentNo, sectionId: releasesSeat ? '' : a.sectionId, history })
      return ok(undefined)
    },

    async assignSection(id, sectionId) {
      const a = find(id)
      if (!a) return fail('Application not found')
      if (sectionId) {
        const sec = ref.current.sections.find((s) => s.id === sectionId)
        if (!sec) return fail('Section not found')
        if (sec.gradeId !== a.gradeId) return fail('Section belongs to a different grade level')
        const load = sectionLoad(sec, ref.current.applications.filter((x) => x.id !== id))
        if (load.full) return fail(`${sec.name} is full (${sec.capacity}/${sec.capacity})`)
      }
      const name = ref.current.sections.find((s) => s.id === sectionId)?.name
      await saveApp({ ...a, sectionId, history: [...a.history, entry('system', sectionId ? `Placed in ${name}` : 'Removed from section')] })
      return ok(undefined)
    },

    async autoPlace() {
      let placed = 0
      for (const a of [...ref.current.applications]) {
        if (a.status !== 'approved' || a.sectionId) continue
        const candidates = ref.current.sections
          .filter((s) => s.gradeId === a.gradeId && s.schoolYearId === a.schoolYearId)
          .map((s) => ({ s, load: sectionLoad(s, ref.current.applications) }))
          .filter((x) => !x.load.full)
          .sort((x, y) => x.load.used / x.s.capacity - y.load.used / y.s.capacity)
        if (!candidates.length) continue
        await saveApp({ ...a, sectionId: candidates[0].s.id, history: [...a.history, entry('system', `Auto-placed in ${candidates[0].s.name}`)] })
        placed++
      }
      return placed
    },

    async addNote(id, text) {
      const a = find(id)
      if (a) await saveApp({ ...a, history: [...a.history, entry('note', text)] })
    },

    async recordPayment(input) {
      const a = find(input.applicationId)
      if (!a) return fail('Application not found')
      if (!(input.amount > 0)) return fail('Enter an amount greater than zero')
      const n = await repository.nextCounter('receipt')
      const p: Payment = {
        id: uid('pay'),
        applicationId: a.id,
        receiptNo: formatNumber(config.rules.receiptNoFormat, schoolYearStart(config, a.schoolYearId), n),
        amount: Math.round(input.amount * 100) / 100,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt || new Date().toISOString(),
        receivedBy: actor,
        note: input.note,
        voided: false,
      }
      await repository.savePayment(p)
      const s = ref.current
      commit({ ...s, payments: [...s.payments, p], counters: { ...s.counters, receipt: n } })
      return ok(p)
    },

    async voidPayment(id, reason) {
      const p = ref.current.payments.find((x) => x.id === id)
      if (!p || p.voided) return
      const next = { ...p, voided: true, note: `${p.note ? `${p.note} · ` : ''}VOID: ${reason}` }
      await repository.savePayment(next)
      commit({ ...ref.current, payments: ref.current.payments.map((x) => (x.id === id ? next : x)) })
      const a = find(p.applicationId)
      if (a) await saveApp({ ...a, history: [...a.history, entry('system', `Receipt ${p.receiptNo} voided — ${reason}`)] })
    },

    async saveSection(s) {
      await repository.saveSection(s)
      const list = ref.current.sections
      commit({ ...ref.current, sections: list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s] })
    },

    async deleteSection(id) {
      if (ref.current.applications.some((a) => a.sectionId === id)) return fail('Remove the students from this section first')
      await repository.deleteSection(id)
      commit({ ...ref.current, sections: ref.current.sections.filter((s) => s.id !== id) })
      return ok(undefined)
    },

    async saveSettings(c) {
      await repository.saveSettings(c)
      commit({ ...ref.current, settings: c })
    },
    async resetSettings() {
      await repository.saveSettings(null)
      commit({ ...ref.current, settings: null })
    },

    async loadDemo() {
      const demo = buildDemoData(config)
      await repository.replaceAll(demo)
      commit(demo)
    },
    async clearData() {
      const empty = { ...emptySnapshot(), settings: ref.current.settings }
      await repository.replaceAll(empty)
      commit(empty)
    },
    exportJson: () => JSON.stringify({ exportedAt: new Date().toISOString(), format: 'school-enrollment/v1', ...ref.current }, null, 2),
    async importJson(text) {
      try {
        const parsed = JSON.parse(text) as Partial<DataSnapshot> & { format?: string }
        if (parsed.format !== 'school-enrollment/v1' || !Array.isArray(parsed.applications)) return fail('This file is not a valid enrollment export')
        const next: DataSnapshot = { ...emptySnapshot(), ...parsed, counters: { ...emptySnapshot().counters, ...parsed.counters } }
        delete (next as Partial<DataSnapshot> & { format?: string }).format
        await repository.replaceAll(next)
        commit(next)
        return ok(undefined)
      } catch {
        return fail('Could not read that file')
      }
    },
  }

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}
