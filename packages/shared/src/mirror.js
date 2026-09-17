export const DEFAULT_MIRROR_POLICY = Object.freeze({
  enabled: true,
  freeOnly: true,
  maxBytes: 512 * 1024 * 1024,
});

export function mirrorDecision(packageInfo, override = {}) {
  const policy = { ...DEFAULT_MIRROR_POLICY, ...override };
  if (typeof policy.enabled !== 'boolean' || typeof policy.freeOnly !== 'boolean' ||
      !Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 0) {
    throw new Error('invalid mirror policy');
  }
  if (!Number.isSafeInteger(packageInfo?.size) || packageInfo.size <= 0) {
    throw new Error('invalid APK size');
  }
  if (!policy.enabled) return { eligible: false, reason: 'disabled' };
  if (policy.freeOnly && !/^0(?:\.0+)?$/.test(String(packageInfo.price ?? ''))) {
    return { eligible: false, reason: 'not_free' };
  }
  if (packageInfo.size > policy.maxBytes) {
    return { eligible: false, reason: 'over_size_limit' };
  }
  return { eligible: true, reason: 'eligible' };
}
