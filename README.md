# School Enrollment System (template)

A reusable, configurable enrollment management system. One codebase, many schools: branding, levels, fees, requirements, form fields, terminology and rules are all data, edited in **Settings** with no code changes.

**Stack:** React 19 + TypeScript + Vite (same as the EMS). **Mode today:** local-first, data in the browser, hash-routed so the built `dist/` runs anywhere (portfolio, iframe, Netlify). **Backend:** Supabase-ready behind a repository interface (`docs/BACKEND.md`, `supabase/schema.sql`).

## Run it
```bash
npm install
npm run dev      # http://localhost:5174
npm test         # business-rule tests
npm run build    # static site in dist/
```
Demo mode is on (`demoMode` in `src/config/school.config.ts`): a first visit starts with ~56 sample students. "Clear data" in Settings -> Data empties it for good. Set `demoMode = false` for a real deployment.

## Where things live
* `#/` is the school's public website (about, programs, admission steps, requirements, fees, the application form, status tracking, FAQ, contact). Its text is edited in Settings -> Website; fees, requirements and levels come from the other Settings tabs.
* `#/app` is the staff system (dashboard, applications, sections, payments, reports, settings).
* `#/apply` and `#/track` are stand-alone versions of the form and the status check.

## What's in version 1
| Area | Details |
|---|---|
| Online application (`#/apply`) | Public form, validation, reference number; `#/track` lets parents check status + missing documents |
| Applications | Search/filter, walk-in encoding, edit, CSV export |
| Review workflow | Applied -> Under review -> Approved -> **Enrolled** (+ Waitlisted / Declined / Withdrawn), full history & notes |
| Enrollment gate | Enroll only when required docs, a section and the down-payment % are satisfied (each rule is switchable) |
| Requirements | Checklist per application, filtered by level and student type |
| Sections | Capacity per section, seat counts, class lists, auto-placement |
| Fees & payments | Per-level fee schedule, optional items, discounts/scholarships, partial payments, printable official receipts, void with reason, accounts receivable |
| Reports | Enrollment by grade/status, demographics, collections by method; CSV: masterlist, class lists, receivables |
| Roles | Administrator / Registrar / Cashier permission matrix (demo switcher; real auth comes with the backend) |
| Settings | School profile & colours, terminology, years, levels/grades/strands, requirements, fees, discounts, custom form fields, numbering, roles, backup/restore, export config as `school.config.ts` |

## Layout
```
src/config/school.config.ts   client defaults (the file you customise per school)
src/core/                     types, pure business rules (logic.ts + tests), data context, storage adapters, demo seed
src/features/                 one file per screen
src/ui/                       layout and shared components
supabase/schema.sql           production database + RLS
docs/CUSTOMIZING.md           onboarding a new school
docs/BACKEND.md               switching on Supabase
```

## Showcase notes
* Each visitor's data stays in their own browser, so a public demo is safe to explore.
* All sample names/numbers are fictional. "Brightwood Academy" is a placeholder.
* Before real student data: connect the backend and review the privacy items in `docs/BACKEND.md`.
