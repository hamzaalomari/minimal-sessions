---
description: Profile a function or hot path and propose targeted optimizations
---

Profile $ARGUMENTS (or the function/section currently under discussion).

Process:
1. Establish the baseline. Either find an existing benchmark or write a minimal one — measure on realistic input sizes, not the smallest case the author had in mind. Cite the numbers.
2. Identify the actual bottleneck before changing anything. Read the code with an algorithmic eye — what's O(n²) that could be O(n)? What's allocating in a hot loop? What's doing synchronous I/O on the main thread?
3. Propose targeted changes in order of expected impact. For each: explain *why* it helps (the underlying mechanism, not just "it's faster") and estimate the magnitude. Don't shotgun micro-optimizations.

Skip:
- Premature optimization in code paths that aren't actually hot.
- Suggestions that trade clarity for fractional gains.

End with a short "What I'd measure next" — invariants you'd want to verify in production (allocation rate, p99 latency, cache hit rate, etc.).
