/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  BusinessUnit,
  BusinessUnitPagedQueryResponse,
  OrderPagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp, q } from '../sdk/use-ctp';
import type { TBusinessRef } from '../session/session-context';

export const businessRef = (bu: BusinessUnit): TBusinessRef => ({
  id: bu.id,
  key: bu.key,
  name: bu.name,
});

/**
 * Search business units (B2B companies/divisions) by name or key. The BU query
 * API has no full-text/contains predicate, and most projects have a small number of
 * units, so we list them (sorted) and filter client-side.
 */
export const useBusinessUnitSearch = (term: string) => {
  const { get } = useCtp();
  const { data, loading, error } = useAsyncData<BusinessUnitPagedQueryResponse>(
    () => get(`/business-units?limit=100&sort=name asc`),
    []
  );
  const all = data?.results ?? [];
  const t = term.trim().toLowerCase();
  const results = t
    ? all.filter(
        (b) =>
          b.name.toLowerCase().includes(t) ||
          b.key.toLowerCase().includes(t) ||
          (b.contactEmail ?? '').toLowerCase().includes(t)
      )
    : all;
  return { results, total: all.length, loading, error };
};

/** Full business-unit record: name, key, associates, stores, addresses, contact. */
export const useBusinessUnit = (id: string) => {
  const { get } = useCtp();
  const { data, loading, error } = useAsyncData<BusinessUnit>(
    () => get(`/business-units/${id}`),
    [id],
    Boolean(id)
  );
  return { business: data, loading, error };
};

/** Recent orders placed under a business unit (B2B orders carry businessUnit). */
export const useBusinessOrders = (businessUnitKey?: string) => {
  const { get } = useCtp();
  const { data, loading } = useAsyncData<OrderPagedQueryResponse>(
    () =>
      get(
        `/orders?limit=20&sort=createdAt desc&where=${q(
          `businessUnit(key = "${businessUnitKey}")`
        )}`
      ),
    [businessUnitKey],
    Boolean(businessUnitKey)
  );
  return { results: data?.results ?? [], total: data?.total ?? 0, loading };
};
