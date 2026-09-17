import type { PublicItem } from './pico.js';

export interface Release {
  versionCode: number;
  firstSeenAt: string;
}

export interface ReleaseState {
  schemaVersion: 1;
  itemId: string | null;
  packageName: string | null;
  name: string | null;
  price: string | null;
  officialUrl: string | null;
  latestVersionCode: number | null;
  releases: Release[];
  lastSuccessfulCheckAt: string | null;
  lastAttemptAt: string;
  stale: boolean;
}

function validTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('invalid check time');
  return timestamp.toISOString();
}

export function applyReleaseCheck(previous: ReleaseState | null, product: PublicItem, checkedAt: string): ReleaseState {
  const time = validTime(checkedAt);
  if (!Number.isSafeInteger(product?.versionCode) || product.versionCode <= 0) throw new Error('invalid version code');
  if (previous?.packageName && previous.packageName !== product.packageName) throw new Error('cannot merge different packages');
  const current = previous?.latestVersionCode ?? 0;
  const upgraded = product.versionCode > current;
  return {
    schemaVersion: 1,
    itemId: product.itemId,
    packageName: product.packageName,
    name: upgraded ? product.name : previous?.name ?? product.name,
    price: upgraded ? product.price : previous?.price ?? product.price,
    officialUrl: upgraded ? product.officialUrl : previous?.officialUrl ?? product.officialUrl,
    latestVersionCode: upgraded ? product.versionCode : current,
    releases: upgraded
      ? [...(previous?.releases ?? []), { versionCode: product.versionCode, firstSeenAt: time }]
      : [...(previous?.releases ?? [])],
    lastSuccessfulCheckAt: time,
    lastAttemptAt: time,
    stale: false,
  };
}

export function markReleaseCheckFailed(previous: ReleaseState | null, attemptedAt: string): ReleaseState {
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
