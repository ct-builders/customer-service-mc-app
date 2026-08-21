/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Make sure to import the helper functions from the `ssr` entry point.
import { entryPointUriPathToPermissionKeys } from '@commercetools-frontend/application-shell/ssr';

declare global {
  interface Window {
    app?: { entryPointUriPath?: string };
  }
}

/**
 * The Merchant Center entry point for this app. Override it per deployment with
 * the ENTRY_POINT_URI_PATH build env var; it must match the "Application URL
 * path" of the Custom Application registration. Lowercase, 2–64 chars,
 * letters/digits/hyphens only.
 *
 * This is read from TWO places on purpose, because this module is loaded in two
 * very different contexts:
 *
 *  1. `window.app.entryPointUriPath` — the browser. appkit injects the compiled
 *     `window.app` blob into index.html, and it is the value the Merchant Center
 *     is actually serving this app under. `process.env` does NOT work here:
 *     mc-scripts only exposes an allowlist of variables to the client bundle, so
 *     a custom `process.env.ENTRY_POINT_URI_PATH` is `undefined` at runtime and
 *     silently collapses to the fallback below. That produced a subtle failure —
 *     custom-application-config.mjs (Node, where the env var IS set) registered
 *     and served the app as `<org>-customer-service`, while the bundle built
 *     its own links as `/customer-service/...` and every in-app navigation 404'd,
 *     and the derived permission keys did not match the registration either.
 *
 *  2. `process.env.ENTRY_POINT_URI_PATH` — Node, when custom-application-config.mjs
 *     imports this file at build time. There is no `window` there.
 */
export const entryPointUriPath =
  (typeof window !== 'undefined' && window.app?.entryPointUriPath) ||
  process.env.ENTRY_POINT_URI_PATH ||
  'customer-service';

export const PERMISSIONS = entryPointUriPathToPermissionKeys(entryPointUriPath);

/**
 * Human-readable name of this app. Single source for three places that must agree:
 * the Custom Application `name`, its main-menu label, and the browser tab title
 * (see src/sdk/use-page-title.ts).
 *
 * Deliberately NOT derived from `entryPointUriPath`: that is a lowercase, hyphenated
 * slug, namespaced per deployment (`acme-customer-service`), and it looked like this in
 * the browser tab until 2026-08-19.
 */
export const APP_TITLE = 'Customer Service';
