/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';

/** The signed-in Merchant Center user acts as the CSR (ticket assignee/author). */
export const useCurrentUser = () => {
  const user = useApplicationContext((context) => context.user);
  const email = user?.email ?? 'CSR';
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || email;
  return { email, name };
};
