/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { APP_TITLE, PERMISSIONS, entryPointUriPath } from './src/constants';

/**
 * Customer Service — a project-agnostic Merchant Center Custom Application.
 *
 * Nothing about a particular deployment is hardcoded; it is all supplied by
 * build environment variables so one codebase can be registered against any
 * commercetools project:
 *
 *   CUSTOM_APPLICATION_ID   assigned by the Merchant Center on registration
 *   APPLICATION_URL         where this app is served (see REGISTRATION.md)
 *   INITIAL_PROJECT_KEY     project key used by `npm start` in development
 *   ENTRY_POINT_URI_PATH    MC "Application URL path" (see src/constants.ts)
 *   STOREFRONT_B2C_URL      default storefront for "shop as customer"
 *   STOREFRONT_B2B_URL      storefront for B2B customers (defaults to the B2C URL)
 *   CSR_EXTRA_FRAME_SRC     comma-separated extra origins to allow in an iframe
 *
 * The storefront URLs are only DEFAULTS: they can be overridden at runtime from
 * the in-app Settings screen, which stores them as a Custom Object. The one
 * thing that cannot move to runtime is the CSP below — see `frameSrc`.
 *
 * There is no shared secret. The "shop as customer" handshake is brokered
 * through a single-use Custom Object token; see src/csr-launch.ts and
 * docs/CSR-STOREFRONT-INTEGRATION.md.
 *
 * @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomApplication}
 */
const storefrontB2cUrl = process.env.STOREFRONT_B2C_URL || '';
const storefrontB2bUrl = process.env.STOREFRONT_B2B_URL || storefrontB2cUrl;

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * Storefronts are embedded in an iframe by the "Place order for customer" CSR
 * flow, and the default appkit CSP is `frame-src 'self'` — which blocks them.
 * Allow exactly the configured storefront origins, nothing wider.
 *
 * This list is COMPILED INTO THE BUNDLE and cannot be changed by the running
 * app. A storefront configured later from the Settings screen will therefore
 * open in a new tab rather than an iframe unless its origin is listed here —
 * add it with CSR_EXTRA_FRAME_SRC and rebuild. The Settings screen surfaces this
 * list and flags any storefront that is not in it.
 */
const frameSrc = [
  ...new Set(
    [
      storefrontB2cUrl,
      storefrontB2bUrl,
      ...(process.env.CSR_EXTRA_FRAME_SRC || '').split(','),
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .map(originOf)
      .filter(Boolean)
  ),
];

const config = {
  name: APP_TITLE,
  description:
    'CSR workspace: customer 360, orders, returns/refunds, assisted ordering, promotions, lists and cases.',
  entryPointUriPath,
  cloudIdentifier: 'gcp-us',
  env: {
    development: {
      initialProjectKey: process.env.INITIAL_PROJECT_KEY || '',
    },
    production: {
      // Assigned by the Merchant Center on registration — see REGISTRATION.md.
      applicationId: process.env.CUSTOM_APPLICATION_ID || '',
      // appkit bakes this into <base href> and the CSP self URL, so DNS + SSL
      // must already resolve for this host before the production build runs.
      url: process.env.APPLICATION_URL || '',
    },
  },
  oAuthScopes: {
    view: [
      'view_customers',
      'view_orders',
      'view_products',
      'view_published_products',
      'view_cart_discounts',
      'view_discount_codes',
      'view_shopping_lists',
      'view_stores',
      'view_business_units',
      'view_key_value_documents',
      'view_states',
    ],
    manage: [
      'manage_customers',
      'manage_orders',
      'manage_shopping_lists',
      'manage_key_value_documents',
    ],
  },
  // Exposed to the app at runtime via useApplicationContext(ctx => ctx.environment).
  additionalEnv: {
    storefrontB2bUrl,
    storefrontB2cUrl,
    // The compiled CSP allowlist, so the Settings screen can tell the operator
    // which storefronts are actually embeddable instead of rendering a blank
    // iframe and a console CSP violation.
    frameSrcOrigins: frameSrc,
  },
  // appkit merges these into its computed CSP (and requires connect-src present).
  headers: {
    csp: {
      'connect-src': ["'self'"],
      'frame-src': frameSrc,
    },
  },
  icon: '${path:@commercetools-frontend/assets/application-icons/rocket.svg}',
  mainMenuLink: {
    defaultLabel: APP_TITLE,
    labelAllLocales: [],
    permissions: [PERMISSIONS.View],
  },
  // No submenu links: clicking "Customer Service" lands on the dashboard, which
  // is the single hub — it links out to Customers/Orders/Returns/Assisted
  // Order/Lists/Tickets (all still routed under this entry point).
  submenuLinks: [],
};

export default config;
