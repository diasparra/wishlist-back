import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { newDb } from 'pg-mem'
import { buildApp } from '../src/app.js'
import { migrate } from '../scripts/migrate.js'
import { seed } from '../scripts/seed.js'

let pool
let app

beforeEach(async () => {
  const mem = newDb()
  const { Pool } = mem.adapters.createPg()
  pool = new Pool()
  await migrate(pool)
  process.env.SEED_MEMBERS = 'Alice,Bob,Carol'
  await seed(pool)
  app = buildApp({ pool, apiToken: undefined, corsOrigin: '*', logger: false })
  await app.ready()
})

const createWish = (payload) =>
  app.inject({
    method: 'POST',
    url: '/wishes',
    payload: { memberId: 'alice', title: 'Bike', ...payload },
  })

test('GET /health', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true })
})

test('GET /members returns the seeded members as camelCase', async () => {
  const res = await app.inject({ method: 'GET', url: '/members' })
  assert.equal(res.statusCode, 200)
  const members = res.json()
  assert.equal(members.length, 3)
  assert.deepEqual(
    members.map((m) => m.id),
    ['alice', 'bob', 'carol'],
  )
})

test('POST /wishes generates an id and echoes a camelCase row', async () => {
  const res = await createWish({ title: 'Road bike' })
  assert.equal(res.statusCode, 201)
  const wish = res.json()
  assert.ok(wish.id)
  assert.equal(wish.memberId, 'alice')
  assert.equal(wish.title, 'Road bike')
  assert.equal(wish.reservedBy, null)
  assert.equal(wish.reservedAt, null)
  assert.ok(wish.createdAt)
})

test('POST /wishes rejects a missing title', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/wishes',
    payload: { memberId: 'alice' },
  })
  assert.equal(res.statusCode, 400)
})

test('PATCH updates whitelisted fields and ignores id / memberId', async () => {
  const created = (await createWish()).json()

  const res = await app.inject({
    method: 'PATCH',
    url: `/wishes/${created.id}`,
    payload: { id: 'HACKED', memberId: 'bob', title: 'Fast bike' },
  })

  assert.equal(res.statusCode, 200)
  const wish = res.json()
  assert.equal(wish.id, created.id)
  assert.equal(wish.memberId, 'alice')
  assert.equal(wish.title, 'Fast bike')
})

test('PATCH can reserve then release a wish', async () => {
  const created = (await createWish()).json()

  let res = await app.inject({
    method: 'PATCH',
    url: `/wishes/${created.id}`,
    payload: { reservedBy: 'bob', reservedAt: new Date().toISOString() },
  })
  assert.equal(res.json().reservedBy, 'bob')
  assert.ok(res.json().reservedAt)

  res = await app.inject({
    method: 'PATCH',
    url: `/wishes/${created.id}`,
    payload: { reservedBy: null, reservedAt: null },
  })
  assert.equal(res.json().reservedBy, null)
  assert.equal(res.json().reservedAt, null)
})

test('DELETE removes the wish, then 404s', async () => {
  const created = (await createWish()).json()
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/wishes/${created.id}` }))
      .statusCode,
    204,
  )
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/wishes/${created.id}` }))
      .statusCode,
    404,
  )
})

test('PATCH 404s for an unknown id', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/wishes/does-not-exist',
    payload: { title: 'x' },
  })
  assert.equal(res.statusCode, 404)
})

test('the bearer token is enforced when API_TOKEN is set', async () => {
  const secured = buildApp({
    pool,
    apiToken: 'sekret',
    corsOrigin: '*',
    logger: false,
  })
  await secured.ready()

  assert.equal(
    (await secured.inject({ method: 'GET', url: '/members' })).statusCode,
    401,
  )
  assert.equal(
    (
      await secured.inject({
        method: 'GET',
        url: '/members',
        headers: { authorization: 'Bearer sekret' },
      })
    ).statusCode,
    200,
  )
  assert.equal(
    (await secured.inject({ method: 'GET', url: '/health' })).statusCode,
    200,
  )
})
