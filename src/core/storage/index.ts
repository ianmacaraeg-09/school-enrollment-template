import { defaultConfig } from '../../config/school.config.ts'
import { createLocalRepository } from './localRepository.ts'
import type { Repository } from './repository.ts'

/**
 * Backend selection. Today: local browser storage.
 *
 * To go live on Supabase (see docs/BACKEND.md):
 *   1. npm i @supabase/supabase-js
 *   2. add src/core/storage/supabaseClient.ts that exports `createClient(url, anonKey)`
 *   3. replace the line below with:
 *        import { createSupabaseRepository } from './supabaseRepository.ts'
 *        import { supabase } from './supabaseClient.ts'
 *        export const repository: Repository = createSupabaseRepository(supabase)
 */
export const repository: Repository = createLocalRepository(defaultConfig.storageNamespace)
export const backendKind: 'local' | 'supabase' = 'local'
