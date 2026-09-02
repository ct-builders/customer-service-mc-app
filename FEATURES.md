# Features

Comprehensive inventory of implemented features in this repository. Source of truth
for what exists in the codebase — keep it updated when features change.

_Last generated: 2026-09-02 by feature-doc._

`customer-service-mc-app` is a **Merchant Center Custom Application** (React SPA built with
`@commercetools-frontend/mc-scripts`/appkit) that gives customer-service agents (CSRs) a single
workspace for customer, order, return, and case management — modeled on Oracle ATG's Commerce
Service Center. It runs **inside** the Merchant Center and calls commercetools only through the
MC API gateway, authenticated as the logged-in MC user — the app never embeds commercetools
client credentials. It is **project-agnostic**: everything project-specific (project key, app URL,
entry point, storefront URLs, the CSR impersonation key) is supplied via build environment
variables read in `custom-application-config.mjs`, so one codebase serves any commercetools
project.

## Architecture & data access

- Entry point (`src/components/entry-point/entry-point.tsx`) wraps the app in
  `@commercetools-frontend/application-shell`'s `ApplicationShell`, code-splits the routes
  bundle, and installs a global error listener before first render.
- `src/sdk/use-ctp.ts` — the single REST client: `get`/`post`/`del`/`search`, all dispatched via
  `useAsyncDispatch`/`actions` through the MC API gateway (`MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM`),
  scoped to the current project key. A `search()` helper hits dedicated MC search proxy targets
  (e.g. `customer-search`, `order-search`) separately from the general `ctp` target.
- `src/sdk/use-async-data.ts` — shared `{ data, loading, error, refetch }` hook every domain hook
  builds on.
- `src/sdk/use-app-base.ts` — resolves `/:projectKey/:entryPointUriPath` as the app's route base.
- `src/sdk/use-current-user.ts` — the signed-in MC user, used as the CSR identity (ticket
  assignee/author, order "placed by agent" attribution).
- `src/sdk/use-page-title.ts` — forces the browser tab to read exactly "Customer Service"
  instead of the Merchant Center shell's default `<entry-point-slug> - <project> - Merchant
  Center` title (fixed 2026-08-19; documented gotcha about `useEffect` vs `useLayoutEffect`
  ordering and re-running on `pathname`).
- `src/constants.ts` — resolves `entryPointUriPath` from `window.app` (browser) or
  `process.env.ENTRY_POINT_URI_PATH` (Node/build), and derives MC permission keys from it via
  `entryPointUriPathToPermissionKeys`.
- `custom-application-config.mjs` — Custom Application registration config: name, entry point,
  `cloudIdentifier: 'gcp-us'`, dev/prod env, OAuth scopes (view: customers/orders/products/
  published-products/cart-discounts/discount-codes/shopping-lists/stores/business-units/
  key-value-documents/states; manage: customers/orders/shopping-lists/key-value-documents), a CSP
  with `frame-src` computed from the configured storefront origins, `additionalEnv` (storefront
  URLs + impersonation key exposed to the client at runtime), single main-menu link with no
  submenu (the dashboard is the hub).
- Routing (`src/routes.tsx`): one `SessionProvider`-scoped `Switch` over
  `/customers`, `/businesses`, `/orders`, `/returns`, `/cart` & `/assisted-order` (aliases),
  `/lists`, `/tickets`, and a full-bleed `/shop` route that skips the status bar/tabs/gutters;
  anything unmatched falls through to `Home`.

## Session / "who am I helping" state

- `src/session/session-context.tsx` — a `SessionProvider` tracks the CSR's current customer,
  current business unit, and current ticket, plus up to 8 recently-selected customers/businesses
  each, persisted to `localStorage` **keyed by project key** (`csr-session-v1:<projectKey>`) so
  switching MC projects never leaks a customer/order from one project into another.
- Setting the current ticket automatically syncs the current customer or business from the
  ticket's stored `customerId`/`businessUnitId`, so the status bar never shows a ticket for one
  person while a different customer is "current".
- `AccountScopeToggle` (`src/components/account-scope-toggle.tsx`) — segmented Individuals /
  Businesses switch atop the Customers list.
- `CustomerPicker` (`src/components/customer-picker.tsx`) — reusable searchable picker showing
  recent customers when idle, search results when a term is typed; used by the status bar,
  Lists, and Assisted Order.
- `DomainTabs` (`src/components/domain-tabs.tsx`) — persistent top navigation (Customer/Business,
  Orders, Cart, Tickets) with number-key shortcuts (1–4, ignored while typing in a field) and
  context-sensitive singular/plural labels (e.g. "Customer" once one is selected).
- `StatusBar` (`src/components/status-bar.tsx`) — sticky bar showing current customer/business
  (with Change/Clear) and current ticket (with Postpone/Transfer/Close and inline
  reassign-by-email), plus one-click "New ticket" when none is open.

## Customers module

- `src/components/customers/customers.tsx` — searchable, sortable, paginated customer list
  (by email, name, customer #, id) and a "New customer" inline create form (creates with a fixed
  placeholder password, which an adopter must replace before this reaches real customers).
- Search (`src/customer-search.ts`, `src/hooks/use-customers.ts`) goes through the
  [Customer Search API](https://docs.commercetools.com/api/projects/customer-search) (ID-first,
  hydrated + re-ordered) and **falls back to scanning** up to 500 recent customers with
  client-side full-field matching (`customerHaystack`/`matchesCustomerTerm`) whenever the index
  is unavailable — deliberate, because Customer Search is off by default per project and
  auto-deactivates after 30 days idle, so "unavailable" is the common case on a new project. The
  UI surfaces which mode served the results.
- `customer-dashboard.tsx` — full customer 360: stats (order count, recent spend, open tickets,
  store-credit balance, member-since date), B2B account panel when the customer is an associate
  of one or more business units (unit type, roles resolved from key→name via
  `use-display-names.ts`, store scope, associate count, parent unit, contact), a recent-orders
  table with drill-in via a shared `OrderDetail` modal, and "Common next steps" (Place order for
  customer, New ticket, Wish lists, File a return). A "Open full profile in MC ↗" link deep-links
  into the native Merchant Center customer screen.
- `useCustomerActions` (`src/hooks/use-customers.ts`) — create customer, generic update, and
  **send password reset** (`POST /customers/password-token`, 3-day TTL) for the "CSR helps a
  locked-out customer" scenario.
- Store credit is read from a `csr-store-credit` Custom Object keyed by customer id
  (`useStoreCredit`); commercetools has no native store-credit entity.

## Businesses (B2B) module

- `src/components/businesses/businesses.tsx` — client-side searchable list of Business Units
  (name, key, contact email, store count, member count); the Business Unit query API has no
  contains/full-text predicate so up to 100 units are listed and filtered in the browser.
- `business-dashboard.tsx` — B2B account 360: member/store/order counts, recent spend, open
  tickets, recent orders scoped by `businessUnit(key = …)`, "Place order in B2B storefront" (as
  the unit's first associate) and "New ticket for business", and the business's own ticket list.
- Both dashboards resolve store, associate-role, and parent-unit **key references** to
  human-readable names (`src/hooks/use-display-names.ts`) — otherwise a CSR sees raw keys like
  `us-large-customers` / `buyer` instead of "US Large Customers" / "Buyer".

## Orders module

- `src/components/orders/orders.tsx` — search by order #, customer email, or (for a
  well-formed UUID) exact id; when no search term is typed and a customer is "current", the list
  auto-scopes to that customer's orders. Sortable/paginated. Deliberately uses plain query
  predicates rather than the Order Search API (which only indexes the last 3 months and needs a
  broader scope than this app should hold).
- `order-detail.tsx` — full order screen:
  - Header with order/payment/shipment status stamps, customer, placed date, tax-inclusive
    total, shipping/billing addresses.
  - **Line items normalized across LineItems and CustomLineItems** in one shape
    (`src/order-lines.ts`) — an order whose catalog lives outside commercetools (external PIM,
    marketplace feed) stores everything as CustomLineItems, and reading `order.lineItems` alone
    used to render an empty table/₀ subtotal/no return options for such orders. Size/color/tax
    code/image are read from configurable custom-field names (default `partNumber`/`size`/
    `color`/`taxCode`/`imageUrl`) for CustomLineItems.
  - Discounted unit price shown with the list price struck through when a line is discounted.
  - Totals breakdown: items subtotal, order-level discount, shipping (or "Free"), tax, total.
  - **Order state controls** — change order state (Open/Confirmed/Complete/Cancelled), shipment
    state (Pending/Ready/Shipped/Delivered/Backorder), payment state
    (Pending/BalanceDue/Paid/Failed/CreditOwed) via `changeOrderState`/`changeShipmentState`/
    `changePaymentState` update actions.
  - **Returns & refunds** — file a return against any line (LineItem or CustomLineItem, correctly
    keyed as `lineItemId` vs `customLineItemId` — a bug fixed so return filing works on
    non-commercetools-catalog orders), list existing return items with payment state, and mark a
    return refunded (`setReturnPaymentState`).
  - **CSR comments** — free-text notes on an order, stored in a `csr-order-comments` Custom
    Object keyed by order id (commercetools has no native order-comment entity).
- `src/hooks/use-orders.ts` also exposes `useOrdersWithReturns` (orders with
  `returnInfo is not empty`, used by both the Returns module and the Home dashboard) and
  `setOmnichannel` (stamps an `omnichannel-order` custom type with fulfillment/pickup fields,
  used for BOPIS-style order tagging).

## Returns & Refunds module

- `src/components/returns/returns.tsx` — overview of every order with at least one return on
  file: order #, customer, total returned quantity, refunded-item count, last-modified date, and
  order state; rows drill into the shared `OrderDetail` screen to file further returns or issue
  refunds.

## Place order for customer ("buy on behalf of")

- `src/components/assisted-order/assisted-order.tsx` (routed at both `/cart` and
  `/assisted-order`) and `src/components/shop/shop-page.tsx` (the full-bleed `/shop` route) —
  the CSR picks (or already has current) a customer, then opens the real storefront **embedded
  in an iframe, logged in as that customer**, so the order placed is exactly the order the
  shopper would have gotten (same PDP, promotions, tax, checkout) rather than a
  reimplementation. All cart-building happens inside the storefront; this app does not build
  carts itself.
- `src/csr-launch.ts` — the handshake contract with the storefront:
  - `GET <storefront>/api/auth/impersonate?customerId=…&key=…&agentEmail=…&agentName=…&parentOrigin=…&businessUnitKey=…&to=…` starts an impersonated session; `?exit=1` (no key) ends it.
  - B2C vs B2B customers are routed to `STOREFRONT_B2C_URL` vs `STOREFRONT_B2B_URL` (B2C defaults
    to the B2B URL when unset).
  - The storefront posts `{ type: 'csr:order-placed', orderId, orderNumber, customerEmail,
    totalCentAmount, currencyCode }` back to `parentOrigin` on checkout; `shop-page.tsx` verifies
    **both** the message origin (against the configured storefront) and its shape before trusting
    it, then shows a success banner, "Open order" deep link into the order-detail screen, and
    writes the order onto the active ticket exactly once (deduped by order id).
  - Leaving the page navigates the iframe to the exit URL and waits for its `onLoad` before
    popping history, so the storefront's session/cookies don't outlive the visit (defense in
    depth — a fresh impersonation always replaces the prior session and drops its bag regardless).
  - An "Open in new tab ↗" escape hatch is offered for browsers (Safari, strict third-party
    cookie blocking) that won't keep the partitioned session cookie alive in a cross-site iframe.
  - With no storefront configured (`STOREFRONT_B2B_URL`/`STOREFRONT_B2C_URL` unset), every other
    module still works — this page explains that no storefront is wired up instead of failing.
- Any assisted-order launch calls `ensureTicket()` first (see Tickets below), so the interaction
  is always captured on a ticket.

## Gift & Wish Lists module

- `src/components/lists/lists.tsx` — for the current customer: view all shopping lists (name,
  item count, created date, line items with quantity), and create a new wish list
  (`ShoppingListDraft`). Prompts for a customer via `CustomerPicker` when none is selected.

## Tickets (case/call tracking) module

- commercetools has no native ticket/case entity, so tickets are modeled as Custom Objects in
  container `csr-tickets` (`src/hooks/use-tickets.ts`), with sequential human-facing ticket
  numbers (starting at 1000) allocated race-safely from a `csr-counters` counter object using
  optimistic-concurrency retry (409 ⇒ re-read and retry, up to 6 attempts).
- `src/components/tickets/tickets.tsx` — full ticket list with filters driven by query params
  (`?mine=1&status=…&priority=…`, deep-linked from the Home dashboard tiles), inline "New ticket"
  form (subject, customer email, priority).
- `ticket-detail.tsx` — ticket header (number, subject, priority/status stamps), business or
  customer facts, linked order number, opened date, a status changer (open/pending/resolved), and
  an append-only activity/notes timeline.
- `src/hooks/use-ensure-ticket.ts` — **auto-ticketing**: any CSR write action (placing an
  assisted order, creating a wish list, etc.) calls `ensureTicket(activity?)`, which opens a
  ticket for the current customer/business if none is open, or appends the activity note to the
  timeline of the one already open — best-effort, non-blocking.
- Status bar ticket controls: Postpone (→ pending), Transfer (reassign to another agent's email),
  Close (→ resolved, then clears the current ticket).

## Home dashboard

- `src/components/home/home.tsx` — greets the signed-in CSR and shows clickable metric tiles:
  my open tickets, open/pending/high-priority/unresolved/resolved ticket counts, total customers,
  total orders, orders with returns, and my recent customers — each tile deep-links into the
  relevant filtered list. Also lists up to 6 of "my open tickets" inline.

## Seed and admin tooling

- `tools/setup-collect-in-store.mjs` — idempotent script that creates a free `collect-in-store`
  shipping method (BOPIS "buy online, pick up in store") by cloning the tax category and zone
  rates of the project's `standard-shipping-method` and zeroing the price. Reads `CTP_*`
  client-credential env vars directly (this is the only place in the repo that talks to
  commercetools outside the MC gateway, and only as an offline setup script).
- `schemas/ctp.json` — a cached commercetools GraphQL introspection schema (tooling artifact, not
  runtime code).

## Legacy / unused code (present but not wired into any route)

The following hooks exist but have no remaining callers in `src/components/*` — cart-building
and product/shipping lookups moved into the embedded storefront (see "Place order for customer"
above), and these appear to be left over from an earlier version where this app built carts
itself:
- `src/hooks/use-carts.ts` (`useCartActions`: createCart/getCart/updateCart/placeOrder/
  addDiscountCode/setDirectDiscounts, plus `absoluteDirectDiscount`).
- `src/hooks/use-products.ts` (`useProductSearch` — product-projections search).
- `src/hooks/use-categories.ts` (`useCategoryTree`).
- `src/hooks/use-shipping-methods.ts` (`useShippingMethods`).
- `src/hooks/use-stores.ts` (`useStores`, `storeName`, `storeCityState` — physical/BOPIS
  pickup-point channels).
- `src/helpers.ts` — Apollo/GraphQL sync-action helpers (`extractErrorFromGraphQlResponse`,
  `createGraphQlUpdateActions`, etc.) with no importers found; looks like unused starter
  boilerplate rather than something this REST-only app relies on.

## Registration, deployment & configuration

- **Deploy**: static SPA on Netlify (`netlify.toml`) — `npm run build` (mc-scripts) publishes
  `public/`, with a catch-all SPA rewrite to `index.html`.
- **Registration** (`REGISTRATION.md`) is per commercetools project: entry point URI paths are
  globally unique across all commercetools organizations and immutable once set, so each project
  needs a namespaced path (e.g. `<project>-customer-service`) and its own build/deploy when the
  Application ID differs. Two registration paths documented: CLI `mc-scripts config:sync`
  (fails for SSO/employee accounts — verified) or the fully-manual Merchant Center UI flow.
- **Local dev**: `npm start` (mc-scripts dev server on `:3001`), requires Administrators-team
  membership in an Organization with access to `INITIAL_PROJECT_KEY`.
- **Quality gates**: `npm run typecheck` (tsc), `npm run lint` (eslint), `npm test` (jest +
  `@commercetools-frontend/jest-preset-mc-app`, msw for mocking), `npm run build` (the pre-deploy
  gate).
- Config knobs (all build-time, via `custom-application-config.mjs` / `.env`): `INITIAL_PROJECT_KEY`,
  `APPLICATION_URL`, `CUSTOM_APPLICATION_ID`, `ENTRY_POINT_URI_PATH`, `STOREFRONT_B2B_URL`,
  `STOREFRONT_B2C_URL`, plus the shared secret the impersonation hand-off is signed with (named in `docs/CSR-STOREFRONT-INTEGRATION.md`, not here).

## Licence, support and the storefront contract (this copy only)

This is the public `ct-builders` copy: MIT (`LICENSE`) with an SPDX header on each source
file, plus `SUPPORT.md` and `CONTRIBUTING.md` stating that the code is unsupported reference
material with no SLA and no behavioural guarantee.

- **`docs/CSR-STOREFRONT-INTEGRATION.md` is the adopter's half of the hand-off.** The Merchant
  Center side of "place order for customer" is finished here; the storefront side is not, and
  the document is the contract for it. It leads with the security requirements, because the
  endpoint it describes creates an authenticated customer session and getting it wrong is an
  authentication bypass.
- **CSR settings are configurable in-app** — `src/components/settings/settings.tsx` with
  `src/hooks/use-csr-settings.ts`, so the storefront URL and hand-off behaviour are set by the
  operator rather than at build time.
