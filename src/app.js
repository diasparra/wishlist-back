import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { rowToMember, rowToWish } from './mappers.js'

// PATCH body key (camelCase, from the frontend) -> wishes column. Anything not
// in this map (notably `id` and `memberId`) is ignored.
const WISH_PATCH_COLUMNS = {
  title: 'title',
  url: 'url',
  notes: 'notes',
  price: 'price',
  priority: 'priority',
  reservedBy: 'reserved_by',
  reservedAt: 'reserved_at',
}

function corsOriginOption(corsOrigin) {
  if (!corsOrigin || corsOrigin === '*') return '*'
  return corsOrigin.split(',').map((entry) => entry.trim())
}

/**
 * Build (but do not start) the Fastify app.
 *
 * @param {object}  opts
 * @param {import('pg').Pool} opts.pool
 * @param {string=} opts.apiToken   if set, every route except /health needs
 *                                  `Authorization: Bearer <apiToken>`
 * @param {string=} opts.corsOrigin comma-separated allow-list, or '*'
 * @param {boolean=} opts.logger
 */
export function buildApp({
  pool,
  apiToken = process.env.API_TOKEN,
  corsOrigin = process.env.CORS_ORIGIN,
  logger = process.env.NODE_ENV !== 'test',
} = {}) {
  const app = Fastify({ logger })

  app.register(cors, { origin: corsOriginOption(corsOrigin) })

  app.addHook('onRequest', async (request, reply) => {
    if (!apiToken) return
    if (request.url.split('?')[0] === '/health') return
    if (request.headers.authorization !== `Bearer ${apiToken}`) {
      reply.code(401).send({ error: 'unauthorized' })
    }
  })

  app.get('/health', async () => ({ ok: true }))

  app.get('/members', async () => {
    const { rows } = await pool.query('SELECT * FROM members ORDER BY name')
    return rows.map(rowToMember)
  })

  app.get('/wishes', async () => {
    const { rows } = await pool.query(
      'SELECT * FROM wishes ORDER BY created_at',
    )
    return rows.map(rowToWish)
  })

  app.post('/wishes', async (request, reply) => {
    const body = request.body ?? {}
    if (!body.memberId || !body.title) {
      return reply.code(400).send({ error: 'memberId and title are required' })
    }
    const { rows } = await pool.query(
      `INSERT INTO wishes
         (id, member_id, title, url, notes, price, priority, created_at, reserved_by, reserved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        randomUUID(),
        body.memberId,
        body.title,
        body.url ?? null,
        body.notes ?? null,
        body.price ?? null,
        body.priority ?? null,
        body.createdAt ?? new Date().toISOString(),
        body.reservedBy ?? null,
        body.reservedAt ?? null,
      ],
    )
    return reply.code(201).send(rowToWish(rows[0]))
  })

  app.patch('/wishes/:id', async (request, reply) => {
    const body = request.body ?? {}
    const sets = []
    const values = []
    for (const [key, column] of Object.entries(WISH_PATCH_COLUMNS)) {
      if (key in body) {
        values.push(body[key])
        sets.push(`${column} = $${values.length}`)
      }
    }

    if (sets.length === 0) {
      const { rows } = await pool.query('SELECT * FROM wishes WHERE id = $1', [
        request.params.id,
      ])
      if (!rows[0]) return reply.code(404).send({ error: 'not found' })
      return rowToWish(rows[0])
    }

    values.push(request.params.id)
    const { rows } = await pool.query(
      `UPDATE wishes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    if (!rows[0]) return reply.code(404).send({ error: 'not found' })
    return rowToWish(rows[0])
  })

  app.delete('/wishes/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM wishes WHERE id = $1', [
      request.params.id,
    ])
    if (rowCount === 0) return reply.code(404).send({ error: 'not found' })
    return reply.code(204).send()
  })

  return app
}
