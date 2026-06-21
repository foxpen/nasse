-- Naše — schéma (spustit v Neon SQL editoru)
CREATE TABLE IF NOT EXISTS listings (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL CHECK (section IN ('byd','auto')),
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_section ON listings(section);
