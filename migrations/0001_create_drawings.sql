-- Migration: create the `drawings` table for the collaborative canvas (State 8).
--
-- Each row is one immutable submission. Drawings are append-only: nobody can
-- edit or delete anyone else's piece, which is the entire grief-resistance
-- model. If something needs to be taken down (offensive content, etc.), set
-- hidden = 1 via SQL — the API filters those out automatically.

CREATE TABLE IF NOT EXISTS drawings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  INTEGER NOT NULL,           -- Unix epoch milliseconds
    name        TEXT,                       -- optional handle (max 40 chars, enforced in worker)
    strokes     TEXT NOT NULL,              -- JSON: array of stroke objects, format defined by canvas UI
    country     TEXT,                       -- 2-letter ISO from Cloudflare cf.country (no IP stored)
    hidden      INTEGER NOT NULL DEFAULT 0  -- 1 = soft-deleted; API filters these out
);

-- Supports the gallery query: WHERE hidden = 0 ORDER BY id DESC LIMIT N
-- Composite (hidden, id) lets SQLite use the index for both the filter and the sort.
CREATE INDEX IF NOT EXISTS idx_drawings_visible_id
    ON drawings(hidden, id DESC);
