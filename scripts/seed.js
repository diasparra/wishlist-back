import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPool } from '../src/db.js'

const ACCENTS = new RegExp('[\\u0300-\\u036f]', 'g')

const slug = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(ACCENTS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Idempotent. Adds members from `SEED_MEMBERS` only when the table is empty;
 * adds a few example wishes only when `SEED_DEMO=true` and there are none.
 */
export async function seed(pool) {
  const names = (process.env.SEED_MEMBERS || 'Alice,Bob,Carol')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const memberCount = await pool.query('SELECT count(*) FROM members')
  if (Number(memberCount.rows[0].count) === 0) {
    for (const name of names) {
      await pool.query('INSERT INTO members (id, name) VALUES ($1, $2)', [
        slug(name),
        name,
      ])
    }
    console.log(`seeded ${names.length} members`)
  }

  if (process.env.SEED_DEMO === 'true') {
    const wishCount = await pool.query('SELECT count(*) FROM wishes')
    if (Number(wishCount.rows[0].count) === 0) {
      const [first, second] = names.map(slug)
      const demo = [
        [first, 'Cordless drill', 'https://example.com/drill'],
        [first, 'Running shoes', 'https://example.com/shoes'],
        [second, 'Wooden chess set', 'https://example.com/chess'],
      ]
      for (const [memberId, title, url] of demo) {
        await pool.query(
          `INSERT INTO wishes (id, member_id, title, url, created_at)
           VALUES ($1, $2, $3, $4, now())`,
          [randomUUID(), memberId, title, url],
        )
      }
      console.log(`seeded ${demo.length} demo wishes`)
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool()
  seed(pool)
    .then(() => pool.end())
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
