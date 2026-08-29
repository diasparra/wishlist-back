// DB rows are snake_case; the frontend (src/dto) expects camelCase JSON.

const iso = (value) =>
  value instanceof Date ? value.toISOString() : (value ?? null)

export const rowToMember = (row) => ({
  id: row.id,
  name: row.name,
  birthday: row.birthday ?? undefined,
})

export const rowToWish = (row) => ({
  id: row.id,
  memberId: row.member_id,
  title: row.title,
  url: row.url ?? undefined,
  notes: row.notes ?? undefined,
  price: row.price ?? undefined,
  priority: row.priority ?? undefined,
  createdAt: iso(row.created_at),
  reservedBy: row.reserved_by ?? null,
  reservedAt: iso(row.reserved_at),
})
