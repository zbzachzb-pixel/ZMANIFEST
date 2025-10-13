import { FirebaseService } from './firebase'
import type { DatabaseService } from './database'

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true'

export const db: DatabaseService = USE_SUPABASE 
  ? (() => { throw new Error('Supabase not implemented yet!') })() 
  : new FirebaseService()

export type { DatabaseService } from './database'