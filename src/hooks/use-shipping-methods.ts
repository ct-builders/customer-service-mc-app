/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ShippingMethodPagedQueryResponse } from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';

/** All shipping methods, so the assisted-order flow can resolve ids by key. */
export const useShippingMethods = () => {
  const { get } = useCtp();
  const { data, loading, error } =
    useAsyncData<ShippingMethodPagedQueryResponse>(
      () => get(`/shipping-methods?limit=100`),
      []
    );
  const methods = data?.results ?? [];
  const byKey = (key: string) => methods.find((m) => m.key === key);
  return { methods, byKey, loading, error };
};
