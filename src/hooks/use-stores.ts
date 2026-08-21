/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  Channel,
  ChannelPagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp, q } from '../sdk/use-ctp';
import { localized } from '../utils';

/** Physical stores are InventorySupply channels that carry an address (BOPIS pickup points). */
export const useStores = () => {
  const { get } = useCtp();
  const { data, loading, error } = useAsyncData<ChannelPagedQueryResponse>(
    () =>
      get(
        `/channels?limit=200&where=${q(
          'roles contains any ("InventorySupply")'
        )}`
      ),
    []
  );
  const stores = (data?.results ?? []).filter((c) => Boolean(c.address));
  return { stores, loading, error };
};

export const storeName = (channel: Channel): string =>
  localized(channel.name) || channel.key || channel.id;

export const storeCityState = (channel: Channel): string => {
  const a = channel.address;
  if (!a) return '';
  return [a.city, a.state].filter(Boolean).join(', ');
};
