---
description: Write or improve tests for the code under discussion
---

Write tests for $ARGUMENTS (or the code currently under discussion if empty).

First, check the existing test setup:
- Detect the test framework already in use (vitest, jest, pytest, go test, etc.) and match its conventions.
- Find a sibling test file or the project's test layout and place new tests there.

Then write tests that cover:
- The happy path with realistic inputs.
- Boundary conditions (empty, max, off-by-one, unicode, etc.).
- Error paths — what happens when each external dependency fails or returns unexpected data.
- Any documented invariant the implementation claims to maintain.

Skip tests that only assert the framework works (e.g. "calling the mock calls the mock"). Each test should be able to catch a real regression.

Finally, run the suite and report the result.
