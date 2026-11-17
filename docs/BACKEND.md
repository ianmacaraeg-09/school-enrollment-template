# Connecting the Supabase backend

The app is local-first today, but all storage goes through one interface (`src/core/storage/repository.ts`). Going live = swapping one file's export. No page changes.

```
Pages -> DataContext -> Repository interface -> localRepository   (now)
                                             -> supabaseRepository (production)
```

## Steps (per client, same stack as EMS)
1. Create a **dedicated Supabase project per client** (their student data must never share a project with another client; do not reuse the EMS project).
2. SQL editor -> paste and run `supabase/schema.sql` (tables, RLS, race-safe counters, public submit/track functions).
3. `npm i @supabase/supabase-js`
4. Add `src/core/storage/supabaseClient.ts`:
   ```ts
   import { createClient } from '@supabase/supabase-js'
   export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
   ```
5. In `src/core/storage/index.ts` switch the export to `createSupabaseRepository(supabase)` (snippet is in the file's comment). Put the URL and anon key in `.env.local` (never commit; the anon key is public by design, the service key must never be in this app).
6. Replace the demo "Viewing as" role switcher with real sign-in: Supabase Auth, then read the user's role from `enroll_profiles` and pass it to `DataProvider` (`role` state in `src/core/DataContext.tsx`). RLS in the schema already enforces roles server-side; the UI permissions are convenience only.
7. Point the public pages at the two server functions instead of reading tables: `/apply` -> `rpc('enroll_submit_application')`, `/track` -> `rpc('enroll_track')`. (The anonymous visitor must not be able to list applications. Today's local `Track` page searches in-memory data, which is only safe in local mode.)
8. Add rate limiting/CAPTCHA to the two public functions, turn on Supabase backups (Pro), and test the whole flow with a non-admin account.

## Known gaps to close before real student data
* `replaceAll` (demo/import) is intentionally disabled on the server backend.
* Student counters run server-side; the local app also passes a formatted number, so move number formatting server-side in `enroll_submit_application` for every format (the function currently supports `{YYYY}` and `{SEQ:4}` only).
* Philippine Data Privacy Act: this system stores minors' personal data. Get the school's privacy notice and consent wording approved, restrict who can export, and keep audit logs (add a trigger on the four record tables) before go-live.
