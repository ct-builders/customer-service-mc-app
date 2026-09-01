# customer-service-mc-app

A **Merchant Center Custom Application** that gives customer-service agents (CSRs) a single
workspace for customer, order, return, and case management.

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
| **Customers** | Search, 360° profile (orders, recent spend, store-credit balance, open tickets, business units, recent orders), create a customer | Customers API; store credit as Custom Objects |
| **Businesses** | Business-unit 360 for B2B accounts — associates, stores, orders, open tickets | Business Units API |
| **Orders** | Search, line items & totals, change order/shipment/payment state (`Cancelled` is one of the four order states), add CSR comments | Orders API; comments as Custom Objects |
| **Returns & Refunds** | List orders with returns, file returns, mark refunded | Order `addReturnInfo` / `setReturnPaymentState` |
| **Place order for customer** | Open the storefront — embedded or in a new tab — logged in **as** the customer, with CSR privileges (per-line price overrides). Cart building happens in the storefront, not here | Storefront `/api/auth/impersonate` (see [Buy on behalf of](#buy-on-behalf-of)) |
| **Gift & Wish Lists** | View and create a customer's shopping lists | Shopping Lists API |
| **Tickets** | Track service cases — priority, status, assignee, note timeline; opened automatically when a CSR acts from the customer, business, wish-list or place-order screen | Custom Objects (`csr-tickets`) |

> commercetools has no native ticket, store-credit or order-comment entity, so the app models
> what it needs as **Custom Objects** — six containers, and nothing else to create in the
> project: `csr-tickets`, `csr-counters` (human-readable ticket numbers), `csr-order-comments`,
> `csr-store-credit`, `csr-settings` (runtime configuration) and `csr-launch-tokens` (the
> "shop as customer" handshake).

## Configuration

Platform wiring is read at **build** time by `custom-application-config.mjs`. Copy
`.env.example` to `.env` for local development, and set the same names as build environment
variables on your host for a deployment.

Storefront wiring is **runtime** configuration: set it on the in-app **Settings** screen, which
stores it as a Custom Object (`csr-settings`) so the app can be re-pointed without a rebuild.
Settings holds the two storefront URLs, how the storefront is opened (`auto`, `embedded` or
`new-tab`) and the launch-token lifetime (30–900 seconds, default 120). The build variables
below are its defaults, and "Revert to build defaults" puts them back.

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
   the customer id, business unit, agent identity, and a short expiry (120 seconds by default,
   30–900 from Settings). Tokens nobody redeemed are swept on the next launch.
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

**Embedding can fail for a second reason, outside this app's control.** Inside the Merchant
Center's iframe the storefront's session cookie is third-party, and browsers increasingly refuse
those — the handshake still succeeds, the token is still redeemed, and the frame comes up blank
or bounced. That is what the launch-mode setting is for: `new-tab` always opens a tab, and
`auto` embeds only when the origin is in the build-time allowlist above.

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
npm run lint         # eslint .
npm test             # jest — 51 tests across three suites
npm run build        # mc-scripts build → public/  (this is the pre-deploy gate)
```

## Architecture

- `src/sdk/use-ctp.ts` — low-level REST client over the MC API gateway (`useAsyncDispatch` + `actions`).
- `src/sdk/use-async-data.ts` — generic loading/error/data hook with `refetch`.
- `src/sdk/use-app-base.ts`, `use-current-user.ts`, `use-page-title.ts` — the app's base path, the
  signed-in MC user, and the browser tab title.
- `src/session/session-context.tsx` — the current customer, business unit and ticket, held across
  screens and shown in the status bar.
- `src/hooks/*` — per-domain data hooks (customers, businesses, orders, carts, products, shopping lists, tickets).
- `src/components/*` — one folder per module, wired in `src/routes.tsx`.
- `src/csr-launch.ts` — mints single-use "shop as customer" launch tokens and builds the URL.
- `src/hooks/use-csr-settings.ts` — runtime storefront configuration (Custom Object) and the
  build-time CSP reality check behind the Settings screen.
- `src/hooks/use-ensure-ticket.ts` — auto-ticketing: opens a ticket for the current customer or
  business if none is current, and appends the activity to its timeline.
- `custom-application-config.mjs` — entry point, region, OAuth scopes, menu links, CSP, `additionalEnv`.

## Deploy

`npm run build` produces a static SPA in `public/`, servable by any static host. A Netlify
configuration is included in `netlify.toml` as a worked example. To make it appear in the
Merchant Center, follow [`REGISTRATION.md`](./REGISTRATION.md).

## License

[MIT](./LICENSE) — freely available, `AS IS` and **unsupported**. See [SUPPORT.md](./SUPPORT.md)
for what that means in practice, and [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to send a
change.
