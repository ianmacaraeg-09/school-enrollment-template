import type { Application, CounterName, DataSnapshot, Payment, SchoolConfig, Section } from '../types.ts'
import { emptySnapshot, type Repository } from './repository.ts'

/** Browser-storage backend. Falls back to memory if storage is blocked (private mode, iframes). */
export function createLocalRepository(namespace: string): Repository {
  const key = `school-enrollment:v1:${namespace}`
  let memory: DataSnapshot | null = null

  const read = (): DataSnapshot => {
    if (memory) return memory
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DataSnapshot>
        return (memory = { ...emptySnapshot(), ...parsed, counters: { ...emptySnapshot().counters, ...parsed.counters } })
      }
    } catch {
      /* blocked or corrupt -> start clean */
    }
    return (memory = emptySnapshot())
  }
  const write = (s: DataSnapshot) => {
    memory = s
    try {
      localStorage.setItem(key, JSON.stringify(s))
    } catch {
      /* quota or blocked: keep working in memory */
    }
  }
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id)
    return i === -1 ? [...list, item] : list.map((x, n) => (n === i ? item : x))
  }

  return {
    async load() {
      return structuredClone(read())
    },
    async saveApplication(a: Application) {
      const s = read()
      write({ ...s, applications: upsert(s.applications, a) })
    },
    async deleteApplication(id: string) {
      const s = read()
      write({ ...s, applications: s.applications.filter((a) => a.id !== id), payments: s.payments.filter((p) => p.applicationId !== id) })
    },
    async savePayment(p: Payment) {
      const s = read()
      write({ ...s, payments: upsert(s.payments, p) })
    },
    async saveSection(sec: Section) {
      const s = read()
      write({ ...s, sections: upsert(s.sections, sec) })
    },
    async deleteSection(id: string) {
      const s = read()
      write({ ...s, sections: s.sections.filter((x) => x.id !== id) })
    },
    async saveSettings(c: SchoolConfig | null) {
      write({ ...read(), settings: c })
    },
    async nextCounter(name: CounterName) {
      const s = read()
      const n = s.counters[name] + 1
      write({ ...s, counters: { ...s.counters, [name]: n } })
      return n
    },
    async replaceAll(s: DataSnapshot) {
      write(structuredClone(s))
    },
  }
}
