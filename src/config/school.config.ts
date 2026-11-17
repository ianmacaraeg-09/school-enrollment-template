// ===========================================================================
//  CLIENT CONFIGURATION  —  the one file you edit when onboarding a new school.
//
//  These are the DEFAULTS. Once the app is running, an administrator can change
//  every value below from Settings; those edits are stored as an override and
//  "Reset to defaults" brings this file's values back.
//
//  Onboarding checklist: docs/CUSTOMIZING.md
// ===========================================================================
import type { SchoolConfig } from '../core/types.ts'

/** Demo mode: a first-time visitor starts with realistic sample data. Set to false for a real deployment. */
export const demoMode = true

export const defaultConfig: SchoolConfig = {
  // Change this per client so demos for different schools never share data.
  storageNamespace: 'brightwood-demo',

  school: {
    name: 'Brightwood Academy',
    shortName: 'Brightwood',
    tagline: 'Learning that lasts a lifetime',
    address: '123 Sampaguita Street, Quezon City, Metro Manila',
    phone: '(02) 8123 4567',
    email: 'registrar@brightwood.example',
    logoText: 'BA', // shown in the logo badge when there is no image
  },

  theme: { primary: '#1d4ed8', accent: '#f59e0b' },

  locale: { currencySymbol: '₱', dateLocale: 'en-PH' },

  // Rename anything the client calls differently ("Learner", "Pupil", "Year Level"...).
  terms: {
    student: 'Student',
    students: 'Students',
    guardian: 'Parent / Guardian',
    gradeLevel: 'Grade Level',
    section: 'Section',
    track: 'Strand',
    application: 'Application',
    schoolYear: 'School Year',
  },

  schoolYears: [
    { id: 'sy2026', name: 'SY 2026-2027', startDate: '2026-06-08', endDate: '2027-03-31' },
    { id: 'sy2027', name: 'SY 2027-2028', startDate: '2027-06-07', endDate: '2028-03-31' },
  ],
  activeSchoolYearId: 'sy2026',

  levels: [
    { id: 'pre', name: 'Preschool', grades: [{ id: 'k1', name: 'Kinder 1' }, { id: 'k2', name: 'Kinder 2' }] },
    {
      id: 'elem',
      name: 'Elementary',
      grades: ['1', '2', '3', '4', '5', '6'].map((n) => ({ id: `g${n}`, name: `Grade ${n}` })),
    },
    {
      id: 'jhs',
      name: 'Junior High School',
      grades: ['7', '8', '9', '10'].map((n) => ({ id: `g${n}`, name: `Grade ${n}` })),
    },
    {
      id: 'shs',
      name: 'Senior High School',
      grades: [{ id: 'g11', name: 'Grade 11' }, { id: 'g12', name: 'Grade 12' }],
    },
  ],

  tracks: [
    { id: 'stem', name: 'STEM', gradeIds: ['g11', 'g12'] },
    { id: 'abm', name: 'ABM', gradeIds: ['g11', 'g12'] },
    { id: 'humss', name: 'HUMSS', gradeIds: ['g11', 'g12'] },
    { id: 'tvl', name: 'TVL - ICT', gradeIds: ['g11', 'g12'] },
  ],

  requirements: [
    { id: 'psa', name: 'PSA Birth Certificate', required: true, levelIds: [], studentTypes: [] },
    { id: 'photo', name: '2x2 ID Photos (2 pcs)', required: true, levelIds: [], studentTypes: [] },
    { id: 'card', name: 'Report Card (Form 138)', required: true, levelIds: ['elem', 'jhs', 'shs'], studentTypes: ['new', 'transferee'] },
    { id: 'goodmoral', name: 'Certificate of Good Moral Character', required: true, levelIds: ['elem', 'jhs', 'shs'], studentTypes: ['transferee'] },
    { id: 'tor', name: 'Transfer Credential / Honorable Dismissal', required: true, levelIds: [], studentTypes: ['transferee'] },
    { id: 'immun', name: 'Immunization Record', required: false, levelIds: ['pre'], studentTypes: [] },
    { id: 'medcert', name: 'Medical Certificate', required: false, levelIds: [], studentTypes: [] },
  ],

  fees: [
    { id: 'tuition-pre', name: 'Tuition', amount: 24000, levelIds: ['pre'], optional: false, discountable: true },
    { id: 'tuition-elem', name: 'Tuition', amount: 32000, levelIds: ['elem'], optional: false, discountable: true },
    { id: 'tuition-jhs', name: 'Tuition', amount: 38000, levelIds: ['jhs'], optional: false, discountable: true },
    { id: 'tuition-shs', name: 'Tuition', amount: 42000, levelIds: ['shs'], optional: false, discountable: true },
    { id: 'misc', name: 'Miscellaneous Fees', amount: 5500, levelIds: [], optional: false, discountable: false },
    { id: 'reg', name: 'Registration Fee', amount: 1500, levelIds: [], optional: false, discountable: false },
    { id: 'lab', name: 'Computer / Science Lab Fee', amount: 2500, levelIds: ['jhs', 'shs'], optional: false, discountable: false },
    { id: 'books', name: 'Books & Learning Materials', amount: 6800, levelIds: [], optional: true, discountable: false },
    { id: 'uniform', name: 'Uniform Set', amount: 3200, levelIds: [], optional: true, discountable: false },
    { id: 'pe', name: 'PE Uniform', amount: 1100, levelIds: [], optional: true, discountable: false },
  ],

  discounts: [
    { id: 'sibling', name: 'Sibling Discount (10% off tuition)', kind: 'percent', value: 10 },
    { id: 'honor', name: 'Academic Honor (20% off tuition)', kind: 'percent', value: 20 },
    { id: 'earlybird', name: 'Early Bird (flat)', kind: 'fixed', value: 1000 },
    { id: 'employee', name: 'Faculty / Staff Dependent (50% off tuition)', kind: 'percent', value: 50 },
  ],

  paymentMethods: ['Cash', 'GCash', 'Bank Transfer', 'Check'],

  // Extra questions on the application form. Add, remove or reorder freely.
  customFields: [
    { id: 'lrn', label: 'Learner Reference No. (LRN)', type: 'text', options: '', required: false, group: 'student', levelIds: ['elem', 'jhs', 'shs'] },
    { id: 'religion', label: 'Religion', type: 'text', options: '', required: false, group: 'student', levelIds: [] },
    { id: 'special', label: 'Special needs / medical conditions', type: 'textarea', options: '', required: false, group: 'student', levelIds: [] },
    { id: 'emergency', label: 'Emergency contact (name & number)', type: 'text', options: '', required: true, group: 'guardian', levelIds: [] },
    { id: 'transport', label: 'Needs school service?', type: 'select', options: 'No,Yes - one way,Yes - two way', required: false, group: 'extra', levelIds: [] },
    { id: 'consent', label: 'I certify that the information given is true and correct.', type: 'checkbox', options: '', required: true, group: 'extra', levelIds: [] },
  ],

  statusLabels: {
    applied: 'Applied',
    review: 'Under Review',
    approved: 'Approved',
    enrolled: 'Enrolled',
    waitlisted: 'Waitlisted',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
  },

  rules: {
    requireDocsToEnroll: true,
    requireSectionToEnroll: true,
    minDownpaymentPercent: 25,
    studentNoFormat: '{YYYY}-{SEQ:5}',
    applicationNoFormat: 'APP-{YYYY}-{SEQ:4}',
    receiptNoFormat: 'OR-{SEQ:6}',
    defaultSectionCapacity: 40,
    onlineApplication: true,
  },

  // The public website (home page). Fees, requirements, levels and school years are read from the settings above.
  landing: {
    heroTitle: 'A place where every child is known by name',
    heroText: 'Small classes, caring teachers and a curriculum that builds confident, curious learners from Kinder to Grade 12. Enrollment for the new school year is open.',
    about: 'Brightwood Academy has been a part of the Quezon City community for more than twenty years. We pair strong academics with character formation, so students leave us ready for college, work and life. Our teachers know every student, and parents are partners in every step.',
    stats: [
      { id: 'st1', value: '20+', label: 'years of service' },
      { id: 'st2', value: '1:20', label: 'teacher to student ratio' },
      { id: 'st3', value: '98%', label: 'graduates who go on to college' },
      { id: 'st4', value: '14', label: 'grade levels, Kinder to Grade 12' },
    ],
    highlights: [
      { id: 'hl1', title: 'Small classes', text: 'No more than 40 seats per section, so every learner gets attention.' },
      { id: 'hl2', title: 'Caring teachers', text: 'Licensed, experienced and trained in student wellbeing.' },
      { id: 'hl3', title: 'Modern facilities', text: 'Science and computer labs, a library and a covered court.' },
      { id: 'hl4', title: 'Scholarships', text: 'Honor, sibling and staff-dependent discounts for qualified families.' },
    ],
    faqs: [
      { id: 'fq1', q: 'When does enrollment open and close?', a: 'Enrollment is open now for the upcoming school year. Slots are limited per grade level, so we recommend applying early.' },
      { id: 'fq2', q: 'Do I need to bring all the documents when I apply?', a: 'No. You can submit the online form first. The registrar will tell you which documents are still missing, and you can check at any time using the Track page.' },
      { id: 'fq3', q: 'How much do I need to pay to reserve a slot?', a: 'A down payment is collected after your application is approved. The exact amount is shown in the fee table on this page.' },
      { id: 'fq4', q: 'Can I pay in installments?', a: 'Yes. Partial payments are accepted through cash, GCash, bank transfer or check, and every payment gets an official receipt.' },
      { id: 'fq5', q: 'My child is transferring from another school. Is that okay?', a: 'Yes. Transferees submit a few extra documents, such as the transfer credential and a certificate of good moral character. They are listed in the requirements section.' },
    ],
    officeHours: 'Monday to Friday, 8:00 AM to 4:30 PM · Saturday, 8:00 AM to 12:00 NN',
  },

  roles: {
    admin: [
      'applications.view', 'applications.edit', 'applications.review', 'applications.enroll',
      'sections.manage', 'payments.view', 'payments.record', 'payments.void', 'reports.view', 'settings.edit',
    ],
    registrar: [
      'applications.view', 'applications.edit', 'applications.review', 'applications.enroll',
      'sections.manage', 'payments.view', 'reports.view',
    ],
    cashier: ['applications.view', 'payments.view', 'payments.record', 'reports.view'],
  },
}
