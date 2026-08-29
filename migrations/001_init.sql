CREATE TABLE IF NOT EXISTS members (
  id       text PRIMARY KEY,
  name     text NOT NULL,
  birthday text
);

CREATE TABLE IF NOT EXISTS wishes (
  id          text PRIMARY KEY,
  member_id   text NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  title       text NOT NULL,
  url         text,
  notes       text,
  price       text,
  priority    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reserved_by text REFERENCES members (id) ON DELETE SET NULL,
  reserved_at timestamptz
);

CREATE INDEX IF NOT EXISTS wishes_member_id_idx ON wishes (member_id);
