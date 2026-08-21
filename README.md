# customer-service-mc-app

A **Merchant Center Custom Application** that gives customer-service agents (CSRs) a single
workspace for customer, order, return, and case management — modeled on the
[Oracle ATG Commerce Service Center](https://docs.oracle.com/cd/E41069_01/Service.11-0/ATGCommerceServiceCenterUserGuide/html/index.html).

It runs **inside** the Merchant Center and talks to commercetools through the Merchant Center
API gateway, authenticating as the logged-in MC user (no commercetools client credentials are
embedded in the app).

The app is **project-agnostic** — nothing about a particular deployment is hardcoded. Point it
at a project through build environment variables, and at a storefront from the in-app Settings
screen (see [Configuration](#configuration)).

> **Freely available, `AS IS` and UNSUPPORTED.** Released under the [MIT License](./LICENSE).
> This is not a commercetools product: no SLA, no roadmap commitment, no security patching, and
> commercetools Support cannot help with it. Review it yourself before you rely on it. See
> [SUPPORT.md](./SUPPORT.md).

## Modules

| Module | What a CSR can do | commercetools backing |
| --- | --- | --- |
| **Customers** | Search, 360° profile, addresses, order history, store-credit balance, create customer, send password reset | Customers API; store credit via Custom Objects |
| **Businesses** | Business-unit 360 for B2B accounts — associates, addresses, orders | Business Units API |
| **Orders** | Search, line items & totals, change order/shipment/payment state, add CSR comments, cancel | Orders API; comments via Custom Objects |
| **Returns & Refunds** | List orders with returns, file returns, mark refunded | Order `addReturnInfo` / `setReturnPaymentState` |
| **Place order for customer** | Open the storefront in an iframe, logged in **as** the customer, with CSR privileges (per-line price overrides) | Storefront `/api/auth/impersonate` (see [Buy on behalf of](#buy-on-behalf-of)) |
| **Gift & Wish Lists** | View and create a customer's shopping lists | Shopping Lists API |
| **Tickets** | Track service cases — call logs, priority, status, note timeline; auto-opened on any CSR write action | Custom Objects (`csr-cases`) |

> commercetools has no native ticket/case or store-credit entity, so those are modeled as
> **Custom Objects** (`csr-cases`, `csr-store-credit`, `csr-order-comments`). This covers ATG's
> "call tracking" concept while keeping the app self-contained.

## Configuration

Platform wiring is read at **build** time by `custom-application-config.mjs`. Copy
`.env.example` to `.env` for local development, and set the same names as build environment
variables on your host for a deployment.

Storefront wiring is **runtime** configuration: set it on the in-app **Settings** screen, which
stores it as a Custom Object so the app can be re-pointed without a rebuild. The build
variables below act as the defaults.

| Variable | Required | What it does |
| --- | --- | --- |
| `INITIAL_PROJECT_KEY` | dev only | commercetools project `npm start` opens |
| `APPLICATION_URL` | prod | Where the app is served. Baked into `<base href>` and the CSP self URL, so DNS + SSL must already resolve before the production build runs |
| `CUSTOM_APPLICATION_ID` | prod | Assigned by the Merchant Center on registration — see [`REGISTRATION.md`](./REGISTRATION.md) |
| `ENTRY_POINT_URI_PATH` | no | MC "Application URL path". Defaults to `customer-service`, but that bare value is already taken — the path is **globally unique across all organizations** and immutable after registration, so namespace it (`<org>-customer-service`). Must match the registration exactly or the MC reload-loops |
| `STOREFRONT_B2C_URL` | no | **Default** storefront for "shop as customer". Overridable at runtime from Settings. Its origin is added to the CSP `frame-src` allowlist |
| `STOREFRONT_B2B_URL` | no | Same, for B2B customers. Defaults to `STOREFRONT_B2C_URL` |
| `CSR_EXTRA_FRAME_SRC` | no | Comma-separated extra origins to allow in an iframe. Needed only for a storefront you will select at runtime that was not known at build time — see below |

With no storefront configured, every module still works — the "Place order for customer" page
explains that none is wired up and links to Settings.

**One thing cannot move to runtime.** A Custom Application is a static bundle, and appkit
compiles its Content-Security-Policy into it. A storefront origin that was not present at build
time can be opened in a **new tab** but cannot be **embedded** in the Merchant Center. Add it
with `CSR_EXTRA_FRAME_SRC` and rebuild; the Settings screen labels each storefront with whether
it qualifies, so this shows up as a badge rather than a blank iframe.

## Buy on behalf of

"Place order for customer" opens the storefront logged in as the customer, so the CSR builds and
places the order in the real storefront rather than in a reimplementation of it.

**Your storefront has to implement its half of this.** The full contract, the security
requirements, and a reference implementation are in
[`docs/CSR-STOREFRONT-INTEGRATION.md`](./docs/CSR-STOREFRONT-INTEGRATION.md).

The handshake is brokered through commercetools, with **no shared secret**:

1. This app writes a single-use launch token as a Custom Object (`csr-launch-tokens`) holding
   the customer id, business unit, agent identity, and a short expiry (default 120s).
2. It opens `<storefront>/api/auth/impersonate?token=<token>` — an opaque token, nothing else.
3. The storefront reads that Custom Object with its own commercetools credentials, rejects it if
   expired, **deletes it** (single use), then starts a session as that customer with `csrMode`
   set. `?exit=1` on the same route ends impersonation.

Why this shape: a Custom Application is a static bundle with no server and no private key, so it
cannot sign the handoff, and any shared secret baked into it would be extractable from the
bundle, would land in access logs and browser history, and would never expire. Instead the trust
comes from commercetools itself — this app reaches the API only through the Merchant Center
gateway, which authenticates as the signed-in MC user, so a token can only exist if a real MC
user with `manage_key_value_documents` minted it.

The storefront's API client needs `view_key_value_documents` and `manage_key_value_documents` in
addition to what it already has.

## Develop locally

```bash
npm install
cp .env.example .env   # set INITIAL_PROJECT_KEY at minimum
npm start              # http://localhost:3001 — log in with your Merchant Center account
```

Local development requires membership in the `Administrators` team of an Organization that has
access to the project in `INITIAL_PROJECT_KEY`.

## Quality gates

```bash
npm run typecheck    # tsc --noEmit
npm run build        # mc-scripts build → public/  (this is the pre-deploy gate)
```

## Architecture

- `src/sdk/use-ctp.ts` — low-level REST client over the MC API gateway (`useAsyncDispatch` + `actions`).
- `src/sdk/use-async-data.ts` — generic loading/error/data hook with `refetch`.
- `src/hooks/*` — per-domain data hooks (customers, businesses, orders, carts, products, shopping lists, tickets).
- `src/components/*` — one folder per module, wired in `src/routes.tsx`.
- `src/csr-launch.ts` — mints single-use "shop as customer" launch tokens and builds the URL.
- `src/hooks/use-csr-settings.ts` — runtime storefront configuration (Custom Object) and the
  build-time CSP reality check behind the Settings screen.
- `custom-application-config.mjs` — entry point, region, OAuth scopes, menu links, CSP, `additionalEnv`.

## Deploy

`npm run build` produces a static SPA in `public/`, servable by any static host. A Netlify
configuration is included in `netlify.toml` as a worked example. To make it appear in the
Merchant Center, follow [`REGISTRATION.md`](./REGISTRATION.md).

## License

[MIT](./LICENSE) — freely available, `AS IS` and **unsupported**. See [SUPPORT.md](./SUPPORT.md)
for what that means in practice, and [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to send a
change.
