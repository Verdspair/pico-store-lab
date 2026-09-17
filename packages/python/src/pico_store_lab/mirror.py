"""Pure mirror-selection policy; no upload occurs here."""

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MirrorPolicy:
    """Operator-configurable selection limits."""

    enabled: bool = True
    free_only: bool = True
    max_bytes: int = 512 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class MirrorDecision:
    """Result of evaluating one package against a policy."""

    eligible: bool
    reason: str


DEFAULT_MIRROR_POLICY = MirrorPolicy()


def mirror_decision(
    *, price: str, size: int, policy: MirrorPolicy = DEFAULT_MIRROR_POLICY
) -> MirrorDecision:
    """Select free packages below the capacity limit by default."""
    if not isinstance(policy.enabled, bool) or not isinstance(policy.free_only, bool):
        raise ValueError("invalid mirror policy")
    if isinstance(policy.max_bytes, bool) or not isinstance(policy.max_bytes, int):
        raise ValueError("invalid mirror policy")
    if policy.max_bytes < 0 or isinstance(size, bool) or not isinstance(size, int) or size <= 0:
        raise ValueError("invalid APK size or mirror policy")
    if not policy.enabled:
        return MirrorDecision(False, "disabled")
    if policy.free_only and re.fullmatch(r"0(?:\.0+)?", price) is None:
        return MirrorDecision(False, "not_free")
    if size > policy.max_bytes:
        return MirrorDecision(False, "over_size_limit")
    return MirrorDecision(True, "eligible")
