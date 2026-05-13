-- Migration 0003: track drawing ownership via a client-generated secret.
--
-- The browser mints a UUID v4 on first submit and stores it in localStorage
-- as `state8.owner.v1`. The client passes it on POST and PATCH; the server
-- uses it as a shared secret to authorize edits to the row.
--
-- Anyone who knows another user's secret can edit their drawing — but the
-- secret is only ever seen by that one browser, so in practice it's
-- per-device ownership. Pre-feature rows have NULL and can never be edited.

ALTER TABLE drawings ADD COLUMN owner_secret TEXT;

CREATE INDEX IF NOT EXISTS idx_drawings_owner_secret
	ON drawings (owner_secret);
