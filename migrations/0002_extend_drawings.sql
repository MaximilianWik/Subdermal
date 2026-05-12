-- Migration 0002: extend drawings with full metadata + add banned_ips table.
--
-- Captures everything the user explicitly asked for: IP, location (city /
-- region / country / colo / postal / timezone), device (UA, accept-language,
-- viewport, DPR), drawing-time, canvas dimensions, plus a bbox for spatial
-- queries when the gallery grows large.
--
-- Likes column is for the heart button. Bbox indexes support
-- "drawings overlapping this viewport" queries we'll need at scale.

ALTER TABLE drawings ADD COLUMN ip                 TEXT;
ALTER TABLE drawings ADD COLUMN user_agent         TEXT;
ALTER TABLE drawings ADD COLUMN accept_language    TEXT;
ALTER TABLE drawings ADD COLUMN city               TEXT;
ALTER TABLE drawings ADD COLUMN region             TEXT;
ALTER TABLE drawings ADD COLUMN colo               TEXT;
ALTER TABLE drawings ADD COLUMN postal_code        TEXT;
ALTER TABLE drawings ADD COLUMN timezone           TEXT;
ALTER TABLE drawings ADD COLUMN viewport_w         INTEGER;
ALTER TABLE drawings ADD COLUMN viewport_h         INTEGER;
ALTER TABLE drawings ADD COLUMN device_pixel_ratio REAL;
ALTER TABLE drawings ADD COLUMN draw_time_ms       INTEGER;
ALTER TABLE drawings ADD COLUMN canvas_width       INTEGER;
ALTER TABLE drawings ADD COLUMN canvas_height      INTEGER;
ALTER TABLE drawings ADD COLUMN likes              INTEGER NOT NULL DEFAULT 0;
ALTER TABLE drawings ADD COLUMN bbox_x1            INTEGER;
ALTER TABLE drawings ADD COLUMN bbox_y1            INTEGER;
ALTER TABLE drawings ADD COLUMN bbox_x2            INTEGER;
ALTER TABLE drawings ADD COLUMN bbox_y2            INTEGER;

CREATE INDEX IF NOT EXISTS idx_drawings_bbox
    ON drawings(bbox_x1, bbox_x2, bbox_y1, bbox_y2);

CREATE TABLE IF NOT EXISTS banned_ips (
    ip         TEXT PRIMARY KEY,
    reason     TEXT,
    banned_at  INTEGER NOT NULL
);
