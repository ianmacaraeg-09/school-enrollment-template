// Demo data for showcases. Generated from the CURRENT config, so it adapts
// to whatever levels, fees and requirements the client has set up.
import { allGrades, assess, emptyApplication, formatNumber, optionalFeesFor, requirementsFor, schoolYearStart, tracksFor } from './logic.ts'
import { emptySnapshot } from './storage/repository.ts'
import type { AppStatus, Application, DataSnapshot, Payment, SchoolConfig, Section } from './types.ts'

const FIRST_M = ['Juan', 'Miguel', 'Gabriel', 'Jose', 'Rafael', 'Carlo', 'Andrei', 'Lance', 'Paolo', 'Nathan', 'Kyle', 'Enzo']
const FIRST_F = ['Maria', 'Sofia', 'Isabella', 'Angela', 'Camille', 'Bea', 'Hannah', 'Patricia', 'Nicole', 'Ysabel', 'Chloe', 'Trisha']
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino', 'Villanueva', 'Castillo', 'Dela Cruz', 'Navarro', 'Domingo', 'Pascual']
const PARENT_F = ['Rosario', 'Elena', 'Lourdes', 'Marites', 'Cynthia', 'Grace', 'Jennifer', 'Liza']
const PARENT_M = ['Ricardo', 'Eduardo', 'Roberto', 'Ernesto', 'Manuel', 'Dennis', 'Arnold', 'Jun']
const STREETS = ['Rizal Ave.', 'Mabini St.', 'Bonifacio St.', 'Luna St.', 'Del Pilar St.', 'Aguinaldo Hwy.', 'Katipunan Ave.']
const SCHOOLS = ['St. Mary Learning Center', 'Little Scholars Academy', 'Holy Family School', 'Riverside Elementary', 'Greenfield High']

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export function buildDemoData(config: SchoolConfig, count = 56): DataSnapshot {
  const rand = rng(2026)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const snap = emptySnapshot()
  snap.settings = config
  const sy = config.activeSchoolYearId
  const year = schoolYearStart(config, sy)
  const grades = allGrades(config)

  // sections: two per grade
  const sections: Section[] = grades.flatMap((g, gi) =>
    ['A', 'B'].map((letter, i): Section => ({
      id: `sec_${g.id}_${letter}`,
      schoolYearId: sy,
      gradeId: g.id,
      name: `${g.name.replace('Grade ', 'G').replace('Kinder ', 'K')}-${['Sampaguita', 'Narra', 'Jasmine', 'Molave'][(gi + i) % 4]}`,
      capacity: i === 0 ? Math.min(config.rules.defaultSectionCapacity, 6) : Math.min(config.rules.defaultSectionCapacity, 10),
      adviser: `${pick(['Ms.', 'Mr.', 'Mrs.'])} ${pick(LAST)}`,
      room: `Room ${101 + gi * 2 + i}`,
    })),
  )
  snap.sections = sections

  const statusPool: AppStatus[] = [
    'applied', 'applied', 'applied', 'review', 'review', 'approved', 'approved', 'enrolled', 'enrolled', 'enrolled',
    'enrolled', 'enrolled', 'waitlisted', 'declined', 'withdrawn',
  ]
  const apps: Application[] = []
  const payments: Payment[] = []
  const used: Record<string, number> = {}

  for (let i = 0; i < count; i++) {
    const grade = pick(grades)
    const male = rand() < 0.5
    const a = emptyApplication(config)
    const created = new Date(Date.UTC(year, 0, 5) + Math.floor(rand() * 150) * 86400000)
    a.id = `demo_${i + 1}`
    a.applicationNo = formatNumber(config.rules.applicationNoFormat, year, i + 1)
    a.schoolYearId = sy
    a.gradeId = grade.id
    const tracks = tracksFor(config, grade.id)
    a.trackId = tracks.length ? pick(tracks).id : ''
    a.studentType = pick(['new', 'new', 'returning', 'returning', 'transferee'] as const)
    a.firstName = pick(male ? FIRST_M : FIRST_F)
    a.middleName = pick(LAST)
    a.lastName = pick(LAST)
    a.sex = male ? 'Male' : 'Female'
    const idx = grades.findIndex((g) => g.id === grade.id)
    a.birthDate = `${year - (5 + idx + (idx > 1 ? 1 : 0)) - Math.floor(rand() * 2)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`
    a.address = `${10 + Math.floor(rand() * 400)} ${pick(STREETS)}, Quezon City`
    a.previousSchool = a.studentType === 'new' ? '' : pick(SCHOOLS)
    const mom = rand() < 0.6
    a.guardian = {
      name: `${pick(mom ? PARENT_F : PARENT_M)} ${a.lastName}`,
      relationship: mom ? 'Mother' : 'Father',
      phone: `09${Math.floor(100000000 + rand() * 899999999)}`,
      email: `${a.lastName.toLowerCase().replace(/\s/g, '')}${i}@example.com`,
      occupation: pick(['Teacher', 'Engineer', 'Nurse', 'Entrepreneur', 'Driver', 'Accountant']),
    }
    for (const f of config.customFields) {
      if (f.type === 'checkbox') a.custom[f.id] = true
      else if (f.type === 'select') a.custom[f.id] = pick(f.options.split(',').map((s) => s.trim()).filter(Boolean))
      else if (f.id === 'emergency') a.custom[f.id] = `${pick(PARENT_F)} ${a.lastName} - 09${Math.floor(100000000 + rand() * 899999999)}`
    }
    a.status = pick(statusPool)
    a.source = rand() < 0.6 ? 'online' : 'walk-in'
    a.createdAt = a.updatedAt = created.toISOString()
    a.optionalFeeIds = optionalFeesFor(config, grade.id).filter(() => rand() < 0.5).map((f) => f.id)
    if (rand() < 0.2 && config.discounts[0]) a.discountIds = [config.discounts[0].id]

    const reqs = requirementsFor(config, a)
    const docOdds = a.status === 'applied' ? 0.3 : a.status === 'review' ? 0.6 : 1
    for (const r of reqs) if (r.required ? rand() < docOdds : rand() < 0.5) a.docs[r.id] = true

    if (a.status === 'approved' || a.status === 'enrolled') {
      const options = sections.filter((s) => s.gradeId === grade.id)
      const open = options.find((s) => (used[s.id] ?? 0) < s.capacity)
      if (open) {
        a.sectionId = open.id
        used[open.id] = (used[open.id] ?? 0) + 1
      } else if (a.status === 'enrolled') {
        a.status = 'approved'
      }
    }
    if (a.status === 'enrolled') {
      snap.counters.student += 1
      a.studentNo = formatNumber(config.rules.studentNoFormat, year, snap.counters.student)
    }

    a.history = [{ id: `h_${i}_1`, at: a.createdAt, by: a.source === 'online' ? 'Online applicant' : 'Registrar', kind: 'system', text: 'Application submitted' }]
    if (a.status !== 'applied')
      a.history.push({ id: `h_${i}_2`, at: a.createdAt, by: 'Registrar', kind: 'status', text: `Status changed to ${config.statusLabels[a.status]}` })

    // payments for approved / enrolled
    if (a.status === 'enrolled' || (a.status === 'approved' && rand() < 0.5)) {
      const total = assess(config, a).total
      const share = a.status === 'enrolled' ? [0.25, 0.4, 0.6, 1][Math.floor(rand() * 4)] : 0.1
      const parts = share === 1 && rand() < 0.5 ? [0.5, 0.5] : [share]
      parts.forEach((part, n) => {
        snap.counters.receipt += 1
        payments.push({
          id: `pay_${i}_${n}`,
          applicationId: a.id,
          receiptNo: formatNumber(config.rules.receiptNoFormat, year, snap.counters.receipt),
          amount: Math.round(total * part * 100) / 100,
          method: pick(config.paymentMethods),
          reference: '',
          paidAt: new Date(created.getTime() + (3 + n * 20) * 86400000).toISOString(),
          receivedBy: 'Cashier',
          note: n === 0 ? 'Down payment' : 'Partial payment',
          voided: false,
        })
      })
    }
    apps.push(a)
  }
  snap.counters.application = count
  snap.applications = apps
  snap.payments = payments
  return snap
}
