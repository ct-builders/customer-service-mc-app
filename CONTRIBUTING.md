# Contributing

Contributions are welcome. This repository is part of the
[`ct-builders`](https://github.com/ct-builders) org, which publishes reference code for
commercetools under the [MIT License](./LICENSE), `AS IS` and unsupported.

Please note the [support policy](./SUPPORT.md) before you invest much effort: pull requests
are read on a best-effort basis, and there is no response-time commitment.

## Two hard requirements

**1. Every source file carries the SPDX license header.**

```ts
/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */
```

No exceptions, including files you only edited. The header is what makes the terms survive
a single file being copied out of context — which is how most of this code will actually be
consumed. A PR that adds a source file without it will be asked to add it.

**2. You may only contribute code you have the right to license under MIT.**

Do not paste in code from another project, a customer engagement, a vendor's repository, or
a Stack Overflow answer unless its license permits redistribution under MIT *and* you
preserve the original copyright notice. If a file or directory is substantially someone
else's work, keep their license file alongside it and leave their headers intact — do not
overwrite them with ours.

If you are unsure whether you may contribute something, do not contribute it.

## This is a public repository

Public, permanently, including git history. Never commit:

- **Credentials of any kind** — API client secrets, tokens, passwords, private keys. Not
  even expired ones, and not even "just in a test fixture".
- **Customer or prospect names**, or anything identifying a specific commercial engagement.
- **Internal infrastructure** — internal hostnames, cloud project ids, database names,
  internal ticket or issue references, internal tooling.
- **Personal data.** Use obviously-synthetic fixtures (`jane@example.com`).

If you commit a secret by accident, treat it as leaked: rotate it first, then worry about
the history.

## Before you open a PR

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (includes prettier)
npm test             # jest
npm run build        # mc-scripts build — the real pre-deploy gate
```

All four must pass. `npm run format` fixes most lint failures.

## What good looks like here

This repository optimizes for **being read**. People land in it to understand how a pattern
works before writing their own version, so:

- **Comment the *why*, not the *what*.** `// increment the counter` is noise. "commercetools
  rejects a stale version with a 409, so two CSRs creating tickets at once never collide" is
  the reason the code is shaped the way it is, and it cannot be recovered from reading it.
- **Match the surrounding code.** Its naming, its comment density, its idioms. A PR that
  introduces a second style makes the codebase harder to read even if the new style is
  better in isolation.
- **Keep it project-agnostic.** Nothing about a particular deployment belongs in `src/`.
  Build-time wiring goes through `custom-application-config.mjs`; anything an operator
  should be able to change belongs on the Settings screen.
- **No credentials in the app.** This app reaches commercetools exclusively through the
  Merchant Center API gateway, authenticating as the signed-in MC user. Adding a
  commercetools client secret to this codebase is a design regression, not a feature.
- **Test the security-relevant paths.** If you touch the CSR launch, cover replay, expiry,
  and forgery. See section 6 of
  [`docs/CSR-STOREFRONT-INTEGRATION.md`](./docs/CSR-STOREFRONT-INTEGRATION.md).

## Reporting a security issue

Open a GitHub issue. There is no private disclosure channel and no embargo process for this
repository — so if the issue is genuinely sensitive, please weigh that before filing.

**Do not** report commercetools *platform* vulnerabilities here. Those go to
[commercetools' official security contact](https://commercetools.com/privacy-and-security).
