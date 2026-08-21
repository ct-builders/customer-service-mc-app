/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  BusinessUnitPagedQueryResponse,
  Customer,
  CustomerPagedQueryResponse,
  CustomerUpdateAction,
} from '@commercetools/platform-sdk';
import {
  buildCustomerSearchBody,
  buildIdPredicate,
  filterCustomers,
  orderByIds,
  FALLBACK_SCAN_LIMIT,
  type TCustomerSearchMode,
} from '../customer-search';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp, q } from '../sdk/use-ctp';

/** Business units the customer is an associate of — non-empty ⇒ a B2B customer. */
export const useCustomerBusinessUnits = (customerId?: string) => {
  const { get } = useCtp();
  const { data, loading } = useAsyncData<BusinessUnitPagedQueryResponse>(
    () =>
      get(
        `/business-units?limit=20&where=${q(
          `associates(customer(id = "${customerId}"))`
        )}`
      ),
    [customerId],
    Boolean(customerId)
  );
  const units = data?.results ?? [];
  return { units, isB2B: units.length > 0, loading };
};

const PAGE = 20;

type SearchOpts = { limit?: number; offset?: number; sort?: string };
type TSearchIdsResponse = { results: { id: string }[]; total: number };
type TSearchResult = {
  results: Customer[];
  total: number;
  mode?: TCustomerSearchMode;
};

/**
 * Search customers, or list the most recent when the term is blank.
 *
 * Searching goes through the [Customer Search API](https://docs.commercetools.com/api/projects/customer-search)
 * at `POST /{projectKey}/customers/search`, which is ID-first — so the IDs it returns are
 * hydrated with a second call and put back into relevance order.
 *
 * If that endpoint is unavailable the search **falls back to scanning** rather than failing.
 * Customer Search is deactivated for a Project by default and auto-deactivates after 30 days
 * without a call, so on a new or quiet project "unavailable" is the normal case, not the exception.
 * See `customer-search.ts`.
 *
 * Note: this previously called a `customer-search` Merchant Center proxy target, which does
 * not exist — the gateway only exposes `ctp`, `ml`, `pim-search`, `order-search`, `import`,
 * `export`, `standalone-prices-search` and `stores-search`. The request failed every time,
 * and because a failed fetch used to leave the previous result on screen, the visible symptom
 * was "search returns every customer no matter what you type".
 */
export const useCustomerSearch = (term: string, opts: SearchOpts = {}) => {
  const { get, post } = useCtp();
  const trimmed = term.trim();
  const limit = opts.limit ?? PAGE;
  const offset = opts.offset ?? 0;
  const sort = opts.sort ?? 'createdAt desc';

  const { data, loading, error, refetch } =
    useAsyncData<TSearchResult>(async () => {
      if (!trimmed) {
        const r = await get<CustomerPagedQueryResponse>(
          `/customers?limit=${limit}&offset=${offset}&sort=${q(sort)}`
        );
        return { results: r.results ?? [], total: r.total ?? 0 };
      }

      try {
        const hits = await post<TSearchIdsResponse>(
          '/customers/search',
          buildCustomerSearchBody(trimmed, limit, offset)
        );
        const ids = (hits.results ?? []).map((h) => h.id);
        if (!ids.length) return { results: [], total: 0, mode: 'index' };
        const full = await get<CustomerPagedQueryResponse>(
          `/customers?limit=${ids.length}&where=${q(buildIdPredicate(ids))}`
        );
        return {
          results: orderByIds(full.results ?? [], ids),
          total: hits.total ?? ids.length,
          mode: 'index',
        };
      } catch (e) {
        // Index off (the default), still building, or the term upset it. Scan instead —
        // a CSR looking someone up mid-call needs an answer, not an error banner.
        console.warn(
          '[customers] Customer Search unavailable, filtering client-side instead:',
          e
        );
        const r = await get<CustomerPagedQueryResponse>(
          `/customers?limit=${FALLBACK_SCAN_LIMIT}&sort=${q(sort)}`
        );
        const matched = filterCustomers(r.results ?? [], trimmed);
        return {
          results: matched.slice(offset, offset + limit),
          total: matched.length,
          mode: 'scan',
        };
      }
    }, [trimmed, limit, offset, sort]);

  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    /** `scan` means the Customer Search index was unavailable — surfaced in the UI. */
    mode: data?.mode,
    loading,
    error,
    refetch,
  };
};

export const useCustomer = (customerId: string) => {
  const { get } = useCtp();
  const { data, loading, error, refetch } = useAsyncData<Customer>(
    () => get(`/customers/${customerId}`),
    [customerId],
    Boolean(customerId)
  );
  return { customer: data, loading, error, refetch };
};

export const useCustomerActions = () => {
  const { post } = useCtp();

  const update = useCallback(
    (
      customer: Pick<Customer, 'id' | 'version'>,
      actions: CustomerUpdateAction[]
    ) =>
      post<Customer>(`/customers/${customer.id}`, {
        version: customer.version,
        actions,
      }),
    [post]
  );

  const create = useCallback(
    (draft: {
      email: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    }) => post<{ customer: Customer }>(`/customers`, draft),
    [post]
  );

  /** Generate a password-reset token (the CSR-initiated "send reset" flow). */
  const requestPasswordReset = useCallback(
    (email: string) =>
      post<{ value: string; expiresAt: string }>(`/customers/password-token`, {
        email,
        ttlMinutes: 4320,
      }),
    [post]
  );

  return { update, create, requestPasswordReset };
};
