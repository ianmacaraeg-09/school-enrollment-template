# Onboarding a new school (customization guide)

Goal: a new client goes from "copy of the template" to "branded demo" in under an hour, without touching application code.

## 1. Start a copy
```bash
cp -r enrollment-template acme-school-enrollment   # or duplicate the folder in Explorer
cd acme-school-enrollment
npm install
npm run dev
```

## 2. Set up the school in the app (no code)
Open **Settings** (switch "Viewing as" to Administrator). Every tab is per-school:

| Tab | What to set |
|---|---|
| School | Name, short name, tagline, address, logo initials, brand colours, currency, locale |
| Terminology | "Student" -> "Learner"/"Pupil", "Section" -> "Class", "Strand" -> "Program", status names |
| School years | The years offered and which one is currently enrolling |
| Levels & grades | Preschool / Elementary / JHS / SHS / College… with their grades, plus tracks/strands/programs |
| Requirements | Documents to collect; can target levels and student types (new / transferee / returning) |
| Fees | Fee schedule per level, optional items (uniform, books), discounts/scholarships, payment methods |
| Form fields | Extra application questions: text, long text, number, date, dropdown, checkbox; per-level |
| Rules | Down-payment %, whether docs/section are required to enroll, numbering formats, online pages on/off |
| Roles | What registrar/cashier/admin may do |

Press **Save changes**. Use **Load sample data** (Data tab) to demo with ~56 realistic records built from the client's own levels and fees.

## 3. Make it the template default
Settings -> **Data** -> **Download school.config.ts**, then replace `src/config/school.config.ts` with it.
Also change `storageNamespace` so two clients' demos on the same domain never share browser data.
(Anyone opening the app with no saved Settings now sees this school's setup.)

## 4. What needs code (rare)
* Logo **image** instead of initials: swap the `Logo` component in `src/ui/Layout.tsx`.
* A new workflow state or report: add to `src/core/types.ts` (`AppStatus`) and `src/core/logic.ts` (`transitions`), covered by `src/core/logic.test.ts`.
* A genuinely new module (attendance, grades): add a folder under `src/features/` and a route in `src/App.tsx`.

## 5. Showcase / portfolio hosting
`npm run build` produces `dist/` that works from any sub-path (hash routing, relative assets). Drop it in a portfolio folder, an `<iframe>`, Netlify or GitHub Pages. Data lives in the visitor's own browser, so visitors can click around freely without affecting each other. Use **Load sample data** or enable it by default if you want the showcase pre-populated (see `README.md`).

## Checklist per client
- [ ] Copy folder, rename in `package.json`
- [ ] Settings configured, saved, exported to `school.config.ts`
- [ ] `storageNamespace` changed
- [ ] Favicon (`public/favicon.svg`) and `<title>` in `index.html`
- [ ] Real fees/requirements confirmed in writing by the school (never guess these)
- [ ] Sample data loaded for the demo; cleared before real use
- [ ] Backend connected before real student data is entered (see `docs/BACKEND.md`)
