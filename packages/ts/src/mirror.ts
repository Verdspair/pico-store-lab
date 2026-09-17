export interface MirrorPolicy {
  enabled: boolean;
  freeOnly: boolean;
  maxBytes: number;
}

export interface MirrorCandidate {
  price: string;
  size: number;
}

export type MirrorReason = 'eligible' | 'disabled' | 'not_free' | 'over_size_limit';

export const DEFAULT_MIRROR_POLICY: Readonly<MirrorPolicy> = Object.freeze({
  enabled: true,
  freeOnly: true,
  maxBytes: 512 * 1024 * 1024,
});

export function mirrorDecision(candidate: MirrorCandidate, override: Partial<MirrorPolicy> = {}): { eligible: boolean; reason: MirrorReason } {
  const policy = { ...DEFAULT_MIRROR_POLICY, ...override };
  if (typeof policy.enabled !== 'boolean' || typeof policy.freeOnly !== 'boolean' ||
      !Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 0) throw new Error('invalid mirror policy');
  if (!Number.isSafeInteger(candidate?.size) || candidate.size <= 0) throw new Error('invalid APK size');
  if (!policy.enabled) return { eligible: false, reason: 'disabled' };
  if (policy.freeOnly && !/^0(?:\.0+)?$/.test(String(candidate.price ?? ''))) return { eligible: false, reason: 'not_free' };
  if (candidate.size > policy.maxBytes) return { eligible: false, reason: 'over_size_limit' };
  return { eligible: true, reason: 'eligible' };
}
