# Seeded bug

Example pure-function bug (Python — plant into `src/taskboard/util.py` `clamp` on a throwaway branch).

**Value-breaking defect** (must fail `tests/test_util.py` when planted):

```python
def clamp(n: float, lo: float, hi: float) -> float:
    if lo > hi:
        raise ValueError(f"lo ({lo}) must be <= hi ({hi})")
    if n < lo:
        return lo
    if n > hi:
        return n  # BUG: should return hi
    return n
```

## Why this bug (not `if n < hi` vs `<=`)

The older illustration used `if n < hi: return n else return hi`. At `n == hi` both the buggy and correct forms return the same value, so existing boundary tests stayed green. That is **not** a valid Fixture B plant.

This plant returns the unclamped value when `n > hi`, so `test_clamp_above_hi` (`clamp(99, 0, 10) == 10`) **must** fail.

## Procedure

1. On a throwaway branch, replace the body of `clamp` in `src/taskboard/util.py` with the buggy version above (keep the docstring or not — behavior is what matters).
2. Run: `python -m pytest tests/test_util.py -q`
3. **Pass (planted):** at least `test_clamp_above_hi` fails (exit ≠ 0). Optionally `/review` also files a bug.
4. Restore correct `clamp` (return `hi` when `n > hi`).
5. **Pass (unplanted):** `python -m pytest tests/test_util.py -q` exits 0.

Delete the plant after verification.
