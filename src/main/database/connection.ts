import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

function isElectron(): boolean {
  try {
    return typeof require('electron').app?.getPath === 'function'
  } catch {
    return false
  }
}

export function getDbPath(): string {
  if (isElectron()) {
    const { app } = require('electron')
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    return join(userDataPath, 'harbor.db')
  }
  return join(process.cwd(), 'harbor-dev.db')
}

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = getDbPath()
    db = new Database(dbPath)

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
