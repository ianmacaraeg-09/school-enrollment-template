// Supabase backend — written against the schema in supabase/schema.sql.
//
// It is typed against a tiny structural client so the template needs no
// @supabase/supabase-js dependency until you actually switch on a backend.
// To enable: `npm i @supabase/supabase-js`, then follow docs/BACKEND.md.
import type { Application, CounterName, DataSnapshot, Payment, SchoolConfig, Section } from '../types.ts'
import { emptySnapshot, type Repository } from './repository.ts'

interface QueryResult<T> { data: T | null; error: { message: string } | null }
interface Table {
  select(cols?: string): PromiseLike<QueryResult<{ id: string; data: unknown }[]>>
  upsert(row: object): PromiseLike<QueryResult<unknown>>
  delete(): { eq(col: string, val: string): PromiseLike<QueryResult<unknown>> }
}
export interface SupabaseLike {
  from(table: string): Table
  rpc(fn: string, args?: object): PromiseLike<QueryResult<number>>
}

function check<T>(r: QueryResult<T>): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** Every record table stores the full object in `data jsonb` plus a few indexed columns. */
export function createSupabaseRepository(db: SupabaseLike): Repository {
  const rows = async <T,>(table: string) => check(await db.from(table).select('id, data')).map((r) => r.data as T)
  const put = async (table: string, id: string, data: object, extra: object = {}): Promise<void> => {
    check(await db.from(table).upsert({ id, data, ...extra }))
  }
  const del = async (table: string, id: string): Promise<void> => {
    check(await db.from(table).delete().eq('id', id))
  }

  return {
    async load(): Promise<DataSnapshot> {
      const [applications, payments, sections, settings] = await Promise.all([
        rows<Application>('enroll_applications'),
        rows<Payment>('enroll_payments'),
        rows<Section>('enroll_sections'),
        rows<SchoolConfig>('enroll_settings'),
      ])
      // Counters live server-side and are only ever advanced via nextCounter().
      return { ...emptySnapshot(), applications, payments, sections, settings: settings[0] ?? null }
    },
    saveApplication: (a: Application) =>
      put('enroll_applications', a.id, a, { status: a.status, grade_id: a.gradeId, school_year_id: a.schoolYearId, section_id: a.sectionId || null }),
    deleteApplication: (id: string) => del('enroll_applications', id),
    savePayment: (p: Payment) => put('enroll_payments', p.id, p, { application_id: p.applicationId, voided: p.voided }),
    saveSection: (s: Section) => put('enroll_sections', s.id, s, { grade_id: s.gradeId, school_year_id: s.schoolYearId }),
    deleteSection: (id: string) => del('enroll_sections', id),
    async saveSettings(c: SchoolConfig | null) {
      if (c === null) await del('enroll_settings', 'default')
      else await put('enroll_settings', 'default', c)
    },
    async nextCounter(name: CounterName) {
      return check(await db.rpc('enroll_next_counter', { counter_name: name }))
    },
    async replaceAll() {
      throw new Error('Bulk replace is disabled on the server backend. Use the SQL import scripts instead.')
    },
  }
}
