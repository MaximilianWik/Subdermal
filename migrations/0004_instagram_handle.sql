-- Migration 0004: optional Instagram handle for the artist's signature.
--
-- Stored as a plain handle (no leading @, no URL). Validated client- and
-- server-side to a-zA-Z0-9._ with length 1..30. Pre-feature rows have NULL.

ALTER TABLE drawings ADD COLUMN instagram_handle TEXT;
