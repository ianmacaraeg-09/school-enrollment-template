// ---------------------------------------------------------------------------
// Domain types. Everything a client can customise lives in SchoolConfig
// (see src/config/school.config.ts); everything students/staff create lives
// in the records below and is persisted through the Repository interface.
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'registrar' | 'cashier'

export type Permission =
  | 'applications.view'
  | 'applications.edit'
  | 'applications.review'
  | 'applications.enroll'
  | 'sections.manage'
  | 'payments.view'
  | 'payments.record'
  | 'payments.void'
  | 'reports.view'
  | 'settings.edit'

export type AppStatus =
  | 'applied'
  | 'review'
  | 'approved'
  | 'enrolled'
  | 'waitlisted'
  | 'declined'
  | 'withdrawn'

export type StudentType = 'new' | 'transferee' | 'returning'
export type CustomValue = string | number | boolean

// ---- configuration --------------------------------------------------------

export interface Grade {
  id: string
  name: string
}
export interface Level {
  id: string
  name: string
  grades: Grade[]
}
export interface Track {
  id: string
  name: string
  /** Grades in which this track/strand must be chosen. */
  gradeIds: string[]
}
export interface SchoolYear {
  id: string
  name: string
  startDate: string
  endDate: string
}
export interface Requirement {
  id: string
  name: string
  required: boolean
  /** Empty = applies to every level. */
  levelIds: string[]
  /** Empty = applies to every student type. */
  studentTypes: StudentType[]
}
export interface Fee {
  id: string
  name: string
  amount: number
  /** Empty = applies to every level. */
  levelIds: string[]
  /** Optional fees are ticked per student (e.g. uniform, books). */
  optional: boolean
  /** Percentage discounts apply only to discountable fees (usually tuition). */
  discountable: boolean
}
export interface Discount {
  id: string
  name: string
  kind: 'percent' | 'fixed'
  value: number
}
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'
export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  /** For `select`: comma-separated options. */
  options: string
  required: boolean
  group: 'student' | 'guardian' | 'extra'
  /** Empty = shown for every level. */
  levelIds: string[]
}

export interface Terms {
  student: string
  students: string
  guardian: string
  gradeLevel: string
  section: string
  track: string
  application: string
  schoolYear: string
}

export interface EnrollmentRules {
  requireDocsToEnroll: boolean
  requireSectionToEnroll: boolean
  /** % of the net assessment that must be paid before enrolling. 0 disables. */
  minDownpaymentPercent: number
  /** Tokens: {YYYY} school-year start year, {SEQ:n} zero-padded counter. */
  studentNoFormat: string
  applicationNoFormat: string
  receiptNoFormat: string
  defaultSectionCapacity: number
  /** Show the public /apply and /track pages. */
  onlineApplication: boolean
}

/** Public landing page content (everything the school's website shows besides fees/requirements, which come from the settings above). */
export interface Landing {
  heroTitle: string
  heroText: string
  about: string
  stats: { id: string; value: string; label: string }[]
  highlights: { id: string; title: string; text: string }[]
  faqs: { id: string; q: string; a: string }[]
  officeHours: string
}

export interface SchoolConfig {
  /** Isolates stored data when several clients' demos share one origin. */
  storageNamespace: string
  school: {
    name: string
    shortName: string
    tagline: string
    address: string
    phone: string
    email: string
    logoText: string
  }
  theme: { primary: string; accent: string }
  locale: { currencySymbol: string; dateLocale: string }
  terms: Terms
  schoolYears: SchoolYear[]
  activeSchoolYearId: string
  levels: Level[]
  tracks: Track[]
  requirements: Requirement[]
  fees: Fee[]
  discounts: Discount[]
  paymentMethods: string[]
  customFields: CustomField[]
  statusLabels: Record<AppStatus, string>
  rules: EnrollmentRules
  landing: Landing
  /** Which permissions each role has. Wire to real auth when a backend exists. */
  roles: Record<Role, Permission[]>
}

// ---- records --------------------------------------------------------------

export interface Guardian {
  name: string
  relationship: string
  phone: string
  email: string
  occupation: string
}

export interface HistoryEntry {
  id: string
  at: string
  by: string
  kind: 'status' | 'note' | 'system'
  text: string
}

export interface Application {
  id: string
  applicationNo: string
  studentNo: string
  schoolYearId: string
  gradeId: string
  trackId: string
  studentType: StudentType
  firstName: string
  middleName: string
  lastName: string
  birthDate: string
  sex: 'Male' | 'Female' | ''
  address: string
  previousSchool: string
  guardian: Guardian
  custom: Record<string, CustomValue>
  /** requirement id -> received */
  docs: Record<string, boolean>
  status: AppStatus
  sectionId: string
  discountIds: string[]
  optionalFeeIds: string[]
  source: 'online' | 'walk-in'
  history: HistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  applicationId: string
  receiptNo: string
  amount: number
  method: string
  reference: string
  paidAt: string
  receivedBy: string
  note: string
  voided: boolean
}

export interface Section {
  id: string
  schoolYearId: string
  gradeId: string
  name: string
  capacity: number
  adviser: string
  room: string
}

export type CounterName = 'application' | 'student' | 'receipt'

export interface DataSnapshot {
  applications: Application[]
  payments: Payment[]
  sections: Section[]
  /** null = use the defaults from school.config.ts */
  settings: SchoolConfig | null
  counters: Record<CounterName, number>
}
