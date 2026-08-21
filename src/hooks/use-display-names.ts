/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  AssociateRolePagedQueryResponse,
  BusinessUnitPagedQueryResponse,
  StorePagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';
import { localized } from '../utils';

/**
 * key -> display name lookups.
 *
 * Several commercetools references carry only a key: a BusinessUnit's `stores` are
 * StoreKeyReferences, its associates' `associateRole`s are AssociateRoleKeyReferences,
 * and `parentUnit` is a BusinessUnitKeyReference. None of them has a name on it, so
 * rendering the reference directly puts `us-large-customers` and `buyer` on screen where
 * a CSR expects "US Large Customers" and "Buyer" — which is what the Merchant Center's
 * own screens show.
 *
 * These are small, stable collections in a B2B project, so each is fetched once and
 * looked up by key. Every hook returns a resolver that falls back to the key, so a
 * missing or unnamed record degrades to today's behaviour rather than a blank.
 */
/** Store keys -> localized store names. */
export const useStoreNames = () => {
  const { get } = useCtp();
  const { data } = useAsyncData<StorePagedQueryResponse>(
    () => get('/stores?limit=200'),
    []
  );
  const byKey = new Map(
    (data?.results ?? []).flatMap((s) =>
      s.key ? [[s.key, localized(s.name) || s.key] as [string, string]] : []
    )
  );
  return (key?: string): string => (key ? byKey.get(key) ?? key : '');
};

/** Associate role keys -> role names ("buyer" -> "Buyer"). */
export const useAssociateRoleNames = () => {
  const { get } = useCtp();
  const { data } = useAsyncData<AssociateRolePagedQueryResponse>(
    () => get('/associate-roles?limit=200'),
    []
  );
  const byKey = new Map(
    (data?.results ?? []).map(
      (r) => [r.key, r.name || r.key] as [string, string]
    )
  );
  return (key?: string): string => (key ? byKey.get(key) ?? key : '');
};

/** Business unit keys -> unit names, for resolving `parentUnit`. */
export const useBusinessUnitNames = () => {
  const { get } = useCtp();
  const { data } = useAsyncData<BusinessUnitPagedQueryResponse>(
    () => get('/business-units?limit=200'),
    []
  );
  const byKey = new Map(
    (data?.results ?? []).flatMap((b) =>
      b.key ? [[b.key, b.name || b.key] as [string, string]] : []
    )
  );
  return (key?: string): string => (key ? byKey.get(key) ?? key : '');
};
