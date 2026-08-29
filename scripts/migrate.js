import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from '../src/db.js'

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
)

/** Apply every `migrations/*.sql` not yet recorded in `schema_migrations`. */
export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const { rows } = await pool.query('SELECT version FROM schema_migrations')
  const applied = new Set(rows.map((row) => row.version))

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    await pool.query(sql)
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
      file,
    ])
    console.log(`migrated ${file}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool()
  migrate(pool)
    .then(() => pool.end())
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
