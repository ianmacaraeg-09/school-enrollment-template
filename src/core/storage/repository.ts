import type { Application, CounterName, DataSnapshot, Payment, SchoolConfig, Section } from '../types.ts'

/**
 * The ONLY door between the app and wherever data lives.
 * - localRepository    -> browser storage (demo / portfolio / offline pilot)
 * - supabaseRepository -> Postgres via Supabase (production, same stack as EMS)
 * Pages never touch storage directly, so switching backends needs no UI changes.
 */
export interface Repository {
  load(): Promise<DataSnapshot>
  saveApplication(a: Application): Promise<void>
  deleteApplication(id: string): Promise<void>
  savePayment(p: Payment): Promise<void>
  saveSection(s: Section): Promise<void>
  deleteSection(id: string): Promise<void>
  /** null clears the override so the defaults in school.config.ts apply. */
  saveSettings(c: SchoolConfig | null): Promise<void>
  /** Atomically increments and returns the next number (must be race-safe on a server). */
  nextCounter(name: CounterName): Promise<number>
  /** Replace everything (demo data, JSON import, reset). */
  replaceAll(s: DataSnapshot): Promise<void>
}

export const emptySnapshot = (): DataSnapshot => ({
  applications: [],
  payments: [],
  sections: [],
  settings: null,
  counters: { application: 0, student: 0, receipt: 0 },
})
