import { describe, expect, it } from 'vitest'
import { defaultConfig as config } from '../config/school.config.ts'
import {
  account,
  assess,
  canEnroll,
  emptyApplication,
  enrollmentReadiness,
  formatNumber,
  requirementsFor,
  roleCan,
  sectionLoad,
  transitions,
  validateApplication,
} from './logic.ts'
import type { Application, Payment } from './types.ts'

const app = (over: Partial<Application> = {}): Application => ({ ...emptyApplication(config), id: 'a1', ...over })
const pay = (amount: number, over: Partial<Payment> = {}): Payment => ({
  id: 'p', applicationId: 'a1', receiptNo: 'OR-1', amount, method: 'Cash', reference: '', paidAt: '', receivedBy: '', note: '', voided: false, ...over,
})

describe('numbering', () => {
  it('formats tokens', () => {
    expect(formatNumber('{YYYY}-{SEQ:5}', 2026, 7)).toBe('2026-00007')
    expect(formatNumber('OR-{SEQ}', 2026, 12)).toBe('OR-12')
  })
})

describe('assessment', () => {
  it('sums level fees and skips optional fees until chosen', () => {
    const a = assess(config, { gradeId: 'g7', optionalFeeIds: [], discountIds: [] })
    // tuition 38000 + misc 5500 + reg 1500 + lab 2500
    expect(a.gross).toBe(47500)
    expect(a.total).toBe(47500)
    const withBooks = assess(config, { gradeId: 'g7', optionalFeeIds: ['books'], discountIds: [] })
    expect(withBooks.total).toBe(54300)
  })
  it('percent discounts hit only discountable fees', () => {
    const a = assess(config, { gradeId: 'g7', optionalFeeIds: [], discountIds: ['sibling'] })
    expect(a.discountTotal).toBe(3800) // 10% of 38000 tuition, not of the whole bill
    expect(a.total).toBe(43700)
  })
  it('stacks discounts but never goes below zero', () => {
    const a = assess(config, { gradeId: 'k1', optionalFeeIds: [], discountIds: ['honor', 'earlybird'] })
    expect(a.total).toBeGreaterThanOrEqual(0)
    const free = assess({ ...config, discounts: [{ id: 'x', name: 'x', kind: 'fixed', value: 999999 }] }, { gradeId: 'k1', optionalFeeIds: [], discountIds: ['x'] })
    expect(free.total).toBe(0)
  })
  it('tracks balance from non-voided payments only', () => {
    const acct = account(config, app({ gradeId: 'g7' }), [pay(10000), pay(5000, { voided: true })])
    expect(acct.paid).toBe(10000)
    expect(acct.balance).toBe(37500)
  })
})

describe('requirements', () => {
  it('filters by level and student type', () => {
    const newK = requirementsFor(config, { gradeId: 'k1', studentType: 'new' }).map((r) => r.id)
    expect(newK).toContain('immun')
    expect(newK).not.toContain('card')
    const tr = requirementsFor(config, { gradeId: 'g8', studentType: 'transferee' }).map((r) => r.id)
    expect(tr).toEqual(expect.arrayContaining(['card', 'goodmoral', 'tor']))
  })
})

describe('enrollment readiness', () => {
  it('blocks until docs, section and down payment are satisfied', () => {
    const a = app({ gradeId: 'g7', studentType: 'new' })
    expect(canEnroll(enrollmentReadiness(config, a, []))).toBe(false)
    const ready = app({ gradeId: 'g7', studentType: 'new', docs: { psa: true, photo: true, card: true }, sectionId: 's1' })
    expect(canEnroll(enrollmentReadiness(config, ready, []))).toBe(false) // no down payment
    expect(canEnroll(enrollmentReadiness(config, ready, [pay(11875)]))).toBe(true) // 25% of 47500
    expect(canEnroll(enrollmentReadiness(config, ready, [pay(11874)]))).toBe(false)
  })
  it('respects rules switched off by the client', () => {
    const loose = { ...config, rules: { ...config.rules, requireDocsToEnroll: false, requireSectionToEnroll: false, minDownpaymentPercent: 0 } }
    expect(canEnroll(enrollmentReadiness(loose, app({ gradeId: 'g7' }), []))).toBe(true)
  })
})

describe('workflow & permissions', () => {
  it('only allows enrolment from approved', () => {
    for (const [from, to] of Object.entries(transitions)) {
      if (from !== 'approved') expect(to).not.toContain('enrolled')
    }
  })
  it('cashier cannot edit settings', () => {
    expect(roleCan(config, 'cashier', 'settings.edit')).toBe(false)
    expect(roleCan(config, 'admin', 'settings.edit')).toBe(true)
  })
})

describe('sections & validation', () => {
  it('counts approved and enrolled as seats', () => {
    const sec = { id: 's1', schoolYearId: 'sy', gradeId: 'g7', name: 'A', capacity: 2, adviser: '', room: '' }
    const apps = [app({ id: '1', sectionId: 's1', status: 'approved' }), app({ id: '2', sectionId: 's1', status: 'declined' })]
    expect(sectionLoad(sec, apps)).toEqual({ used: 1, free: 1, full: false })
  })
  it('flags missing fields, requires strand for SHS and the consent checkbox', () => {
    const errs = validateApplication(config, app({ gradeId: 'g11' }))
    expect(errs.firstName).toBeDefined()
    expect(errs.trackId).toBeDefined()
    expect(errs['custom:consent']).toBeDefined()
  })
})
