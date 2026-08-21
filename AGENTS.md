# Customer Service — Merchant Center Custom Application

Read `README.md` first: it covers the modules, configuration, and the "buy on behalf of"
handshake. This file is the working context for agents.

## Purpose

A CSR workspace that runs **inside** the Merchant Center. It authenticates as the logged-in MC
user through the MC API gateway — there are **no commercetools client credentials in this
repo**, and there must never be any.

Deliberately **project-agnostic**: nothing about a particular deployment is hardcoded. Project key,
app URL, entry point, and storefront wiring all come from build env vars consumed by
`custom-application-config.mjs`. Adding a deployment-specific constant to `src/` is a regression —
put it in `.env.example` and thread it through `additionalEnv` instead.

## Commands

```sh
npm start          # dev server on :3001, logs into the MC
npm run typecheck  # tsc --noEmit
npm run build      # mc-scripts build → public/   ← pre-deploy gate, must pass
npm test           # jest
npm run lint       # eslint
```

## Layout

- `src/sdk/use-ctp.ts` — REST client over the MC API gateway (`useAsyncDispatch` + `actions`).
  All commercetools traffic goes through here.
- `src/sdk/use-async-data.ts` — generic `{ data, loading, error, refetch }` hook.
- `src/hooks/*` — one hook module per domain. Data fetching lives here, not in components.
- `src/components/*` — one folder per module, wired in `src/routes.tsx`.
- `src/session/session-context.tsx` — the CSR's "who am I helping" state (current customer /
  business / ticket), persisted to localStorage. Not a commercetools session.
- `src/csr-launch.ts` — the "shop as customer" URL builder plus `useCsrLaunchConfig()`, which
  reads the storefront wiring out of `additionalEnv`.
- `custom-application-config.mjs` — entry point, region, OAuth scopes, menu links, CSP,
  `additionalEnv`. Every deployment knob is here.

## Conventions

- UI is commercetools UIKit (`@commercetools-uikit/*`). Match the surrounding components rather
  than introducing another styling approach.
- Any CSR **write** action calls `ensureTicket()` (`src/hooks/use-ensure-ticket.ts`) so the
  interaction lands on a ticket timeline. Best-effort; never block the action on it.
- commercetools has no case/store-credit entity — those are Custom Objects in the containers
  `csr-cases`, `csr-store-credit`, `csr-order-comments`. They are created on first write.
- Adding a new OAuth scope to `custom-application-config.mjs` requires re-syncing the MC
  registration (see `REGISTRATION.md`), otherwise requests 403 at runtime.

## Gotchas

- **Infinite reload after install** ⇒ the registered entry point URI path doesn't match
  `entryPointUriPath`. Both must agree. The path is baked in at build time, so changing
  `ENTRY_POINT_URI_PATH` requires a rebuild, not just a redeploy of the same bundle.
- **"A Custom Application with this value already exists"** on registration ⇒ entry point
  URI paths are globally unique across every commercetools organization, not just yours.
  Namespace per deployment (`<org>-customer-service`). It cannot be changed after registration.
- `APPLICATION_URL` is baked into `<base href>` and the CSP self URL at build time. DNS + SSL
  for that host must resolve **before** the production build, or the app 404s its own assets.
- A storefront won't render in the "Place order for customer" iframe unless its origin is in
  the CSP `frame-src` — derived from `STOREFRONT_B2B_URL`/`STOREFRONT_B2C_URL`, so set those
  rather than editing the CSP by hand.
- `public/` is build output and is gitignored. Netlify publishes it; don't commit it.
