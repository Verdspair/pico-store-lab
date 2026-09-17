function validTime(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('invalid check time');
  return timestamp.toISOString();
}

export function applyReleaseCheck(previous, product, checkedAt) {
  const time = validTime(checkedAt);
  if (!Number.isSafeInteger(product?.versionCode) || product.versionCode <= 0) {
    throw new Error('invalid version code');
  }
  if (previous?.packageName && previous.packageName !== product.packageName) {
    throw new Error('cannot merge different packages');
  }
  const prior = previous?.releases ?? [];
  const current = previous?.latestVersionCode ?? 0;
  const upgraded = product.versionCode > current;
  const releases = upgraded
    ? [...prior, { versionCode: product.versionCode, firstSeenAt: time }]
    : [...prior];
  return {
    schemaVersion: 1,
    itemId: product.itemId,
    packageName: product.packageName,
    name: product.name,
    price: product.price,
    officialUrl: product.officialUrl ?? previous?.officialUrl ?? null,
    latestVersionCode: upgraded ? product.versionCode : current,
    releases,
    lastSuccessfulCheckAt: time,
    lastAttemptAt: time,
    stale: false,
  };
}

export function markReleaseCheckFailed(previous, attemptedAt) {
  const time = validTime(attemptedAt);
  return {
    schemaVersion: 1,
    itemId: previous?.itemId ?? null,
    packageName: previous?.packageName ?? null,
    name: previous?.name ?? null,
    price: previous?.price ?? null,
    officialUrl: previous?.officialUrl ?? null,
    latestVersionCode: previous?.latestVersionCode ?? null,
    releases: [...(previous?.releases ?? [])],
    lastSuccessfulCheckAt: previous?.lastSuccessfulCheckAt ?? null,
    lastAttemptAt: time,
    stale: true,
  };
}
