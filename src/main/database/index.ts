import { getDatabase } from './connection'
import { createSchema } from './schema'

export function initDatabase(): void {
  const db = getDatabase()
  createSchema(db)
  console.log('[Harbor] Database ready at:', db.name)
}

export { getDatabase } from './connection'
