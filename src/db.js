import pg from 'pg'

/**
 * A pg Pool from `DATABASE_URL`. The API is otherwise DB-agnostic — tests pass a
 * pg-mem-backed pool into `buildApp` instead of calling this.
 */
export function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  return new pg.Pool({ connectionString })
}
