---
description: Review code for security issues — injection, auth, secrets, unsafe deps
---

Perform a focused security review of the code under discussion (or the path/scope in $ARGUMENTS if provided). Look for:

- **Injection vectors** — SQL/NoSQL, command, template, prototype pollution, deserialisation. Cite the vulnerable line.
- **Authn / authz gaps** — missing checks, wrong-tenant access, JWT/session handling, IDOR.
- **Secrets and credentials** — hard-coded keys, secrets in logs, weak crypto, exposed `.env` reads.
- **Unsafe input handling** — XSS, open redirects, unsafe `eval`/`Function`, regex DoS, path traversal.
- **Dependency risk** — outdated or unmaintained packages, postinstall hooks, lockfile drift.
- **Race conditions and TOCTOU** in security-relevant code paths.

For each finding, give: severity (critical/high/medium/low), exact location (file:line), short rationale, and a concrete fix (code or strategy). End with a one-paragraph summary of the overall security posture and the top 3 things to address first.
