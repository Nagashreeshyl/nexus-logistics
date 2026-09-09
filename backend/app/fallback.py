"""Priority-scaled drop penalties. Hard windows and capacities stay binding."""

CRITICAL_PENALTY = 1_000_000
NORMAL_PENALTY = 8_000


def drop_penalty(priority: str) -> int:
    return CRITICAL_PENALTY if priority == "critical" else NORMAL_PENALTY
