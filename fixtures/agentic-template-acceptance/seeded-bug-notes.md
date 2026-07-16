# Seeded bug

Example pure-function bug (Python illustration — use language-equivalent in-repo):

    def clamp(n, lo, hi):
        if n < lo:
            return lo
        if n < hi:  # BUG: should be <=
            return n
        return hi

Delete after verification.
