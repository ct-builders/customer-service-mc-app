# Support

**There is no support for this software.**

It is published under the [MIT License](./LICENSE) so you can freely use, modify, and
redistribute it. That is the entire arrangement. Please read this before you build
something load-bearing on top of it.

## What this means concretely

| | |
|---|---|
| **Warranty** | None. `AS IS`, per the MIT License |
| **Service level** | None. No uptime, response-time, or fix-time commitment of any kind |
| **commercetools Support** | Cannot help with this code. Do not open a support ticket about it — it is not part of any commercetools product or subscription |
| **Issues and pull requests** | Read on a best-effort basis when someone has time. Many will go unanswered. That is not rudeness, it is the stated arrangement |
| **Security fixes** | No commitment to investigate or patch, and no embargo process. Please still report what you find — just do not wait on a fix |
| **Breaking changes** | Possible at any time, without notice, deprecation period, or migration guide |
| **Maintenance** | Not guaranteed to continue. This repository may be archived without warning |

## Not a commercetools product

This code was written by people who work at commercetools, and the copyright is held by
commercetools GmbH and the contributors to the `ct-builders` org. That is the extent of the
relationship. Publishing it here is not an endorsement, a support commitment, or a statement
that this is how commercetools recommends you build.

For the platform itself — which *is* supported — use the official channels:

- [commercetools documentation](https://docs.commercetools.com)
- [commercetools support portal](https://support.commercetools.com)

## If you are going to production with this

You own it. At minimum, before you ship:

- **Review the security posture yourself.** In particular, read
  [`docs/CSR-STOREFRONT-INTEGRATION.md`](./docs/CSR-STOREFRONT-INTEGRATION.md) — the CSR
  launch creates authenticated customer sessions, and the storefront half of that handshake
  is yours to implement correctly.
- **Scope your API clients.** Never deploy with a `manage_project` client.
- **Decide what an impersonating agent may do.** This app does not restrict it for you.
- **Add your own observability, rate limiting, and audit logging.** There is none here.
- **Pin and audit dependencies.** They are not being updated for you.

## Getting help anyway

Your best options, in order:

1. Read the code. It is commented with the reasoning, not just the mechanics.
2. Open an issue — someone may well answer, just do not depend on it.
3. Fork it. That is what the MIT License is for, and it is the only option with a
   guaranteed outcome.
