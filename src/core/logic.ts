// Pure business rules. No React, no storage — easy to unit-test and to reuse
// unchanged on a server (e.g. a Supabase Edge Function) later.
import type {
  AppStatus,
  Application,
  CustomField,
  Fee,
  Payment,
  Permission,
  Requirement,
  Role,
  SchoolConfig,
  Section,
} from './types.ts'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`

// ---- names & lookups ------------------------------------------------------

export function fullName(a: Pick<Application, 'firstName' | 'middleName' | 'lastName'>) {
  const mid = a.middleName ? ` ${a.middleName.trim().charAt(0).toUpperCase()}.` : ''
  return `${a.lastName.trim()}, ${a.firstName.trim()}${mid}`
}

export function gradeInfo(config: SchoolConfig, gradeId: string) {
  for (const level of config.levels) {
    const grade = level.grades.find((g) => g.id === gradeId)
    if (grade) return { level, grade }
  }
  return null
}
export const gradeName = (config: SchoolConfig, gradeId: string) => gradeInfo(config, gradeId)?.grade.name ?? 'Unknown'
export const levelIdOf = (config: SchoolConfig, gradeId: string) => gradeInfo(config, gradeId)?.level.id ?? ''
export const allGrades = (config: SchoolConfig) => config.levels.flatMap((l) => l.grades)
export const tracksFor = (config: SchoolConfig, gradeId: string) => config.tracks.filter((t) => t.gradeIds.includes(gradeId))

// ---- permissions ----------------------------------------------------------

export const roleCan = (config: SchoolConfig, role: Role, permission: Permission) =>
  config.roles[role]?.includes(permission) ?? false

// ---- numbering ------------------------------------------------------------

/** "{YYYY}-{SEQ:5}" + (2026, 7) -> "2026-00007" */
export function formatNumber(format: string, year: number | string, seq: number) {
  return format
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, width) => String(seq).padStart(Number(width ?? 0), '0'))
}

export function schoolYearStart(config: SchoolConfig, schoolYearId: string) {
  const sy = config.schoolYears.find((s) => s.id === schoolYearId)
  const y = sy ? new Date(sy.startDate).getFullYear() : new Date().getFullYear()
  return Number.isFinite(y) ? y : new Date().getFullYear()
}

// ---- requirements ---------------------------------------------------------

export function requirementsFor(config: SchoolConfig, a: Pick<Application, 'gradeId' | 'studentType'>): Requirement[] {
  const levelId = levelIdOf(config, a.gradeId)
  return config.requirements.filter(
    (r) =>
      (r.levelIds.length === 0 || r.levelIds.includes(levelId)) &&
      (r.studentTypes.length === 0 || r.studentTypes.includes(a.studentType)),
  )
}

export function requirementProgress(config: SchoolConfig, a: Application) {
  const reqs = requirementsFor(config, a)
  const mandatory = reqs.filter((r) => r.required)
  const missing = mandatory.filter((r) => !a.docs[r.id])
  return { all: reqs, mandatory, missing, complete: missing.length === 0 }
}

// ---- fees -----------------------------------------------------------------

export function feesFor(config: SchoolConfig, a: Pick<Application, 'gradeId' | 'optionalFeeIds'>): Fee[] {
  const levelId = levelIdOf(config, a.gradeId)
  return config.fees.filter(
    (f) => (f.levelIds.length === 0 || f.levelIds.includes(levelId)) && (!f.optional || a.optionalFeeIds.includes(f.id)),
  )
}

export function optionalFeesFor(config: SchoolConfig, gradeId: string): Fee[] {
  const levelId = levelIdOf(config, gradeId)
  return config.fees.filter((f) => f.optional && (f.levelIds.length === 0 || f.levelIds.includes(levelId)))
}

export interface Assessment {
  items: { id: string; name: string; amount: number }[]
  gross: number
  discounts: { id: string; name: string; amount: number }[]
  discountTotal: number
  total: number
}

export function assess(config: SchoolConfig, a: Pick<Application, 'gradeId' | 'optionalFeeIds' | 'discountIds'>): Assessment {
  const fees = feesFor(config, a)
  const items = fees.map((f) => ({ id: f.id, name: f.name, amount: round2(f.amount) }))
  const gross = round2(items.reduce((s, i) => s + i.amount, 0))
  const discountable = round2(fees.filter((f) => f.discountable).reduce((s, f) => s + f.amount, 0))

  let remaining = gross
  const discounts: Assessment['discounts'] = []
  for (const id of a.discountIds) {
    const d = config.discounts.find((x) => x.id === id)
    if (!d) continue
    const raw = d.kind === 'percent' ? (discountable * d.value) / 100 : d.value
    const amount = round2(Math.min(raw, remaining)) // never discount below zero
    remaining = round2(remaining - amount)
    discounts.push({ id: d.id, name: d.name, amount })
  }
  const discountTotal = round2(discounts.reduce((s, d) => s + d.amount, 0))
  return { items, gross, discounts, discountTotal, total: round2(gross - discountTotal) }
}

export function paidTotal(payments: Payment[], applicationId: string) {
  return round2(payments.filter((p) => p.applicationId === applicationId && !p.voided).reduce((s, p) => s + p.amount, 0))
}

export function account(config: SchoolConfig, a: Application, payments: Payment[]) {
  const assessment = assess(config, a)
  const paid = paidTotal(payments, a.id)
  return { assessment, paid, balance: round2(assessment.total - paid) }
}

// ---- workflow -------------------------------------------------------------

export const transitions: Record<AppStatus, AppStatus[]> = {
  applied: ['review', 'approved', 'waitlisted', 'declined', 'withdrawn'],
  review: ['approved', 'waitlisted', 'declined', 'withdrawn'],
  approved: ['enrolled', 'waitlisted', 'declined', 'withdrawn'],
  enrolled: ['withdrawn'],
  waitlisted: ['review', 'approved', 'declined', 'withdrawn'],
  declined: ['review'],
  withdrawn: ['review'],
}

/** Sections hold a seat once the applicant is approved or enrolled. */
export const holdsSeat = (s: AppStatus) => s === 'approved' || s === 'enrolled'

export interface ReadinessCheck {
  key: 'docs' | 'section' | 'downpayment'
  label: string
  detail: string
  ok: boolean
  blocking: boolean
}

export function enrollmentReadiness(config: SchoolConfig, a: Application, payments: Payment[]): ReadinessCheck[] {
  const { rules } = config
  const req = requirementProgress(config, a)
  const acct = account(config, a, payments)
  const needed = round2((acct.assessment.total * rules.minDownpaymentPercent) / 100)
  const checks: ReadinessCheck[] = [
    {
      key: 'docs',
      label: 'Required documents',
      detail: req.complete ? 'All required documents received' : `Missing: ${req.missing.map((m) => m.name).join(', ')}`,
      ok: req.complete,
      blocking: rules.requireDocsToEnroll,
    },
    {
      key: 'section',
      label: `${config.terms.section} assigned`,
      detail: a.sectionId ? 'Placed' : `No ${config.terms.section.toLowerCase()} yet`,
      ok: !!a.sectionId,
      blocking: rules.requireSectionToEnroll,
    },
  ]
  if (rules.minDownpaymentPercent > 0) {
    checks.push({
      key: 'downpayment',
      label: `Down payment (${rules.minDownpaymentPercent}%)`,
      detail: acct.paid >= needed ? 'Down payment met' : `Needs ${money(config, needed)}, paid so far ${money(config, acct.paid)}`,
      ok: acct.paid >= needed,
      blocking: true,
    })
  }
  return checks
}

export const canEnroll = (checks: ReadinessCheck[]) => checks.every((c) => c.ok || !c.blocking)

// ---- sections -------------------------------------------------------------

export function sectionLoad(section: Section, applications: Application[]) {
  const used = applications.filter((a) => a.sectionId === section.id && holdsSeat(a.status)).length
  return { used, free: Math.max(0, section.capacity - used), full: used >= section.capacity }
}

// ---- forms ----------------------------------------------------------------

export function customFieldsFor(config: SchoolConfig, gradeId: string): CustomField[] {
  const levelId = levelIdOf(config, gradeId)
  return config.customFields.filter((f) => f.levelIds.length === 0 || f.levelIds.includes(levelId))
}

export function validateApplication(config: SchoolConfig, a: Application): Record<string, string> {
  const e: Record<string, string> = {}
  if (!a.gradeId) e.gradeId = `Choose a ${config.terms.gradeLevel.toLowerCase()}`
  if (tracksFor(config, a.gradeId).length > 0 && !a.trackId) e.trackId = `Choose a ${config.terms.track.toLowerCase()}`
  if (!a.firstName.trim()) e.firstName = 'Required'
  if (!a.lastName.trim()) e.lastName = 'Required'
  if (!a.birthDate) e.birthDate = 'Required'
  else if (new Date(a.birthDate) > new Date()) e.birthDate = 'Birth date cannot be in the future'
  if (!a.sex) e.sex = 'Required'
  if (!a.address.trim()) e.address = 'Required'
  if (!a.guardian.name.trim()) e.guardianName = 'Required'
  if (!a.guardian.phone.trim()) e.guardianPhone = 'Required'
  else if (a.guardian.phone.replace(/\D/g, '').length < 7) e.guardianPhone = 'Enter a valid phone number'
  if (a.guardian.email && !/^\S+@\S+\.\S+$/.test(a.guardian.email)) e.guardianEmail = 'Enter a valid email'
  for (const f of customFieldsFor(config, a.gradeId)) {
    const v = a.custom[f.id]
    if (f.required && (f.type === 'checkbox' ? v !== true : v === undefined || String(v).trim() === ''))
      e[`custom:${f.id}`] = f.type === 'checkbox' ? 'Please confirm to continue' : 'Required'
  }
  return e
}

export function emptyApplication(config: SchoolConfig): Application {
  const now = new Date().toISOString()
  return {
    id: '',
    applicationNo: '',
    studentNo: '',
    schoolYearId: config.activeSchoolYearId,
    gradeId: '',
    trackId: '',
    studentType: 'new',
    firstName: '',
    middleName: '',
    lastName: '',
    birthDate: '',
    sex: '',
    address: '',
    previousSchool: '',
    guardian: { name: '', relationship: '', phone: '', email: '', occupation: '' },
    custom: {},
    docs: {},
    status: 'applied',
    sectionId: '',
    discountIds: [],
    optionalFeeIds: [],
    source: 'walk-in',
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

// ---- formatting -----------------------------------------------------------

export function money(config: SchoolConfig, n: number) {
  return `${config.locale.currencySymbol}${n.toLocaleString(config.locale.dateLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function dateText(config: SchoolConfig, iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(config.locale.dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ageOn(birthDate: string, on = new Date()) {
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}
