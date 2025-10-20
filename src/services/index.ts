import { FirebaseService } from './firebase'
import type { DatabaseService } from './database'

// Create the database service instance
export const db: DatabaseService = new FirebaseService()

// Also export the type for convenience
export type { DatabaseService } from './database'