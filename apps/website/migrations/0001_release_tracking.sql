CREATE TABLE IF NOT EXISTS products (
  item_id TEXT PRIMARY KEY,
  package_name TEXT NOT NULL,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  official_url TEXT NOT NULL,
  latest_version_code INTEGER NOT NULL,
  last_success_at TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS releases (
  item_id TEXT NOT NULL,
  version_code INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (item_id, version_code)
);
