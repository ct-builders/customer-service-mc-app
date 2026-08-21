/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_TITLE } from '../constants';

/**
 * Put this app's display name in the browser tab, and nothing else.
 *
 * The Merchant Center shell titles every tab
 * `<second path segment> - <projectKey> - Merchant Center`, taking that first part
 * straight from the URL. For a native screen that reads fine ("orders - my-project -
 * Merchant Center"); for a Custom Application it is the raw entry-point slug, which
 * is per-deployment namespaced and hyphenated — "acme-customer-service - … ". So the tab
 * showed an internal identifier rather than the name of the app.
 *
 * The shell's own `<ApplicationPageTitle additionalParts={[...]} />` cannot fix this:
 * it *prepends* to that same template, so the slug stays in the title and the result
 * is longer, not cleaner.
 *
 * Two details make overriding it reliable, and both are load-bearing:
 *
 *  - **`useEffect`, not `useLayoutEffect`.** The shell sets the title in a
 *    `useLayoutEffect`. React flushes all layout effects before any passive effect,
 *    so a passive effect always lands last regardless of tree position — which a
 *    layout effect of our own would not, since sibling order would decide it.
 *  - **Keyed on `pathname`.** The shell re-applies its title on every route change,
 *    so this has to re-run on the same trigger or the slug returns the first time
 *    someone clicks through to Customers.
 *
 * The project key and the "Merchant Center" suffix are dropped deliberately (asked
 * for on 2026-08-19): the tab should read exactly "Customer Service". That is a
 * departure from how native Merchant Center screens title themselves, so if this ever
 * needs to match them again, the shape is
 * `[APP_TITLE, projectKey, 'Merchant Center'].join(' - ')`.
 */
export const usePageTitle = (): void => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = APP_TITLE;
  }, [pathname]);
};
