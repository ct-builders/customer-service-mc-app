/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Customer } from '@commercetools/platform-sdk';

/**
 * Customer search request building and the client-side fallback filter.
 *
 * Two modes exist on purpose:
 *
 * - `index` — the [Customer Search API](https://docs.commercetools.com/api/projects/customer-search)
 *   (`POST /{projectKey}/customers/search`). ID-first and relevance-ordered, and the right
 *   answer at real scale.
 * - `scan` — fetch a page of Customers and filter here.
 *
 * The fallback is not belt-and-braces, it is load-bearing: Customer Search is **deactivated
 * for a Project by default**, and it **auto-deactivates after 30 days with no calls**. A quiet
 * that only used the index would therefore work, sit unused for a month, and be broken on the
 * morning someone needed it. Scanning always works.
 */

/** Which path produced a result set, so the UI can say when it degraded. */
export type TCustomerSearchMode = 'index' | 'scan';

/**
 * How many Customers `scan` mode pulls before filtering. 500 is the API's max page size and
 * comfortably covers a small catalogue; past that, the index is the only correct answer and the
 * UI says so rather than quietly truncating.
 */
export const FALLBACK_SCAN_LIMIT = 500;

export type TCustomerSearchBody = {
  query: { fullText: { field: 'all'; value: string } };
  limit: number;
  offset: number;
};

/**
 * `field: 'all'` matches a string in any Customer field — the closest thing to what a CSR
 * means when they type into one box. It is the one text field that does *not* support
 * wildcard expressions, so the term is passed through as-is.
 */
export const buildCustomerSearchBody = (
  term: string,
  limit: number,
  offset: number
): TCustomerSearchBody => ({
  query: { fullText: { field: 'all', value: term.trim() } },
  limit,
  offset,
});

/** `id in ("a","b")` — used to hydrate the full records the ID-first search returns. */
export const buildIdPredicate = (ids: ReadonlyArray<string>): string =>
  `id in (${ids.map((id) => `"${id}"`).join(',')})`;

/**
 * The fields a CSR actually types: what the search box promises ("email, name, customer # or
 * id") plus the other unique identifiers someone might paste off a ticket.
 */
export const customerHaystack = (customer: Customer): string =>
  [
    customer.email,
    customer.firstName,
    customer.middleName,
    customer.lastName,
    customer.companyName,
    customer.customerNumber,
    customer.externalId,
    customer.vatId,
    customer.key,
    customer.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/**
 * Every whitespace-separated word must appear somewhere. "jane acme" matches Jane at Acme;
 * it is not an exact-phrase match, because a CSR types fragments in whatever order.
 */
export const matchesCustomerTerm = (
  customer: Customer,
  term: string
): boolean => {
  const needles = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!needles.length) return true;
  const haystack = customerHaystack(customer);
  return needles.every((needle) => haystack.includes(needle));
};

export const filterCustomers = (
  customers: ReadonlyArray<Customer>,
  term: string
): Customer[] =>
  customers.filter((customer) => matchesCustomerTerm(customer, term));

/** Order hydrated records back into the relevance order the search returned them in. */
export const orderByIds = (
  customers: ReadonlyArray<Customer>,
  ids: ReadonlyArray<string>
): Customer[] => {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  return ids
    .map((id) => byId.get(id))
    .filter((customer): customer is Customer => Boolean(customer));
};
