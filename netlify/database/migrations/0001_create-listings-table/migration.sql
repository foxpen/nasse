CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_section_idx ON listings (section);
