-- Migration 0005: per-browser uniqueness on likes.
--
-- Until now, POST /api/drawings/:id/like blindly incremented the
-- `likes` counter on every call, so anyone could spam-like a single
-- drawing thousands of times. This adds a `likes` table that records
-- which owner_secret has liked which drawing, with a composite primary
-- key that makes "one like per browser per drawing" a hard database
-- constraint. The endpoint becomes a toggle: INSERT decrements remote
-- once-per-secret, DELETE allows un-liking, and the drawings.likes
-- counter is kept in lockstep.
--
-- The aggregate `drawings.likes` column stays — it's still the number
-- the client renders — so the existing feed/detail/mine reshapes don't
-- need to change.

CREATE TABLE IF NOT EXISTS likes (
	drawing_id  INTEGER NOT NULL,
	liker       TEXT    NOT NULL,
	liked_at    INTEGER NOT NULL,
	PRIMARY KEY (drawing_id, liker)
);

CREATE INDEX IF NOT EXISTS idx_likes_liker ON likes (liker);
