import { PICO_ITEM_ID } from '@nkanf-dev/pico-store-sdk/pico';

export async function readReleaseState(db) {
  const product = await db.prepare('SELECT * FROM products WHERE item_id = ?').bind(PICO_ITEM_ID).first();
  if (!product) return null;
  const result = await db.prepare('SELECT version_code, first_seen_at FROM releases WHERE item_id = ? ORDER BY version_code ASC').bind(PICO_ITEM_ID).all();
  return {
    schemaVersion: 1,
    itemId: product.item_id,
    packageName: product.package_name,
    name: product.name,
    price: product.price,
    officialUrl: product.official_url,
    latestVersionCode: product.latest_version_code,
    releases: result.results.map(row => ({ versionCode: row.version_code, firstSeenAt: row.first_seen_at })),
    lastSuccessfulCheckAt: product.last_success_at,
    lastAttemptAt: product.last_attempt_at,
    stale: Boolean(product.stale),
  };
}

export async function recordReleaseSuccess(db, product, completedAt) {
  const time = new Date(completedAt).toISOString();
  const insertRelease = db.prepare(`
    INSERT OR IGNORE INTO releases (item_id, version_code, first_seen_at)
    SELECT ?, ?, ? WHERE ? > COALESCE(
      (SELECT latest_version_code FROM products WHERE item_id = ?), 0
    )
  `).bind(product.itemId, product.versionCode, time, product.versionCode, product.itemId);
  const upsertProduct = db.prepare(`
    INSERT INTO products (
      item_id, package_name, name, price, official_url,
      latest_version_code, last_success_at, last_attempt_at, stale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(item_id) DO UPDATE SET
      name = CASE WHEN excluded.latest_version_code >= products.latest_version_code THEN excluded.name ELSE products.name END,
      price = CASE WHEN excluded.latest_version_code >= products.latest_version_code THEN excluded.price ELSE products.price END,
      official_url = CASE WHEN excluded.latest_version_code >= products.latest_version_code THEN excluded.official_url ELSE products.official_url END,
      latest_version_code = MAX(products.latest_version_code, excluded.latest_version_code),
      last_success_at = MAX(products.last_success_at, excluded.last_success_at),
      last_attempt_at = MAX(products.last_attempt_at, excluded.last_attempt_at),
      stale = 0
  `).bind(
    product.itemId, product.packageName, product.name, product.price,
    product.officialUrl, product.versionCode, time, time,
  );
  // D1 batch is a transaction: the version test and both writes are serialized.
  await db.batch([insertRelease, upsertProduct]);
}

export async function recordReleaseFailure(db, startedAt, completedAt) {
  const start = new Date(startedAt).toISOString();
  const finish = new Date(completedAt).toISOString();
  await db.prepare(`
    UPDATE products SET
      last_attempt_at = MAX(last_attempt_at, ?),
      stale = CASE WHEN last_success_at > ? THEN stale ELSE 1 END
    WHERE item_id = ?
  `).bind(finish, start, PICO_ITEM_ID).run();
}
