---
description: Walk through how a file, function, or system actually works
---

Explain $ARGUMENTS — what it does, why it exists, and how it fits with the rest of the codebase. If $ARGUMENTS is empty, ask the user what they want explained.

Aim for the level of someone who's a competent engineer but new to this codebase:

- Start with the one-sentence purpose.
- Walk through the data/control flow in the order it actually executes, citing file:line.
- Surface invariants and assumptions that aren't obvious from the code.
- Point out any subtlety, footgun, or "why isn't this simpler" — those are the load-bearing details.
- Skip the boilerplate explanation a competent reader can derive themselves.

End with: "Things to be careful about when changing this:" and 2–4 concrete warnings.
