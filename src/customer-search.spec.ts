/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Customer } from '@commercetools/platform-sdk';
import {
  buildCustomerSearchBody,
  buildIdPredicate,
  customerHaystack,
  filterCustomers,
  matchesCustomerTerm,
  orderByIds,
} from './customer-search';

const customer = (over: Partial<Customer> = {}): Customer =>
  ({
    id: 'id-1',
    version: 1,
    email: 'jane.doe@acme.example',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModifiedAt: '2026-01-01T00:00:00.000Z',
    addresses: [],
    isEmailVerified: true,
    authenticationMode: 'Password',
    ...over,
  } as Customer);

describe('buildCustomerSearchBody', () => {
  it('queries the "all" text field, which is what one search box means', () => {
    expect(buildCustomerSearchBody('acme', 20, 40)).toEqual({
      query: { fullText: { field: 'all', value: 'acme' } },
      limit: 20,
      offset: 40,
    });
  });

  it('trims the term so a stray space is not searched for', () => {
    expect(buildCustomerSearchBody('  jane  ', 5, 0).query.fullText.value).toBe(
      'jane'
    );
  });
});

describe('buildIdPredicate', () => {
  it('quotes every id', () => {
    expect(buildIdPredicate(['a', 'b'])).toBe('id in ("a","b")');
  });
});

describe('matchesCustomerTerm', () => {
  const jane = customer({
    email: 'jane.doe@acme.example',
    firstName: 'Jane',
    lastName: 'Doe',
    companyName: 'Acme Industrial',
    customerNumber: 'C-4471',
  });

  it.each([
    ['email fragment', 'acme.example'],
    ['first name, wrong case', 'JANE'],
    ['last name', 'doe'],
    ['company', 'industrial'],
    ['customer number', 'C-4471'],
    ['id', 'id-1'],
    ['two fragments in either order', 'doe jane'],
  ])('matches on %s', (_label, term) => {
    expect(matchesCustomerTerm(jane, term)).toBe(true);
  });

  it.each([
    ['a name that is not there', 'smith'],
    ['a partial match plus a miss', 'jane smith'],
    ['another customer number', 'C-9999'],
  ])('does not match on %s', (_label, term) => {
    expect(matchesCustomerTerm(jane, term)).toBe(false);
  });

  it('matches everything on a blank term, so browsing is unfiltered', () => {
    expect(matchesCustomerTerm(jane, '   ')).toBe(true);
  });

  it('tolerates a customer with almost no fields set', () => {
    const sparse = customer({
      firstName: undefined,
      lastName: undefined,
      email: 'x@y.example',
    });
    expect(customerHaystack(sparse)).toContain('x@y.example');
    expect(matchesCustomerTerm(sparse, 'x@y')).toBe(true);
    expect(matchesCustomerTerm(sparse, 'jane')).toBe(false);
  });
});

describe('filterCustomers', () => {
  it('narrows the set — the regression this whole fix exists for', () => {
    const all = [
      customer({ id: '1', email: 'jane@acme.example', firstName: 'Jane' }),
      customer({ id: '2', email: 'bob@other.example', firstName: 'Bob' }),
      customer({ id: '3', email: 'sue@acme.example', firstName: 'Sue' }),
    ];
    expect(filterCustomers(all, 'acme').map((c) => c.id)).toEqual(['1', '3']);
    expect(filterCustomers(all, 'bob').map((c) => c.id)).toEqual(['2']);
    // The bug: a search that matches nothing must return nothing, never the full list.
    expect(filterCustomers(all, 'nobody')).toEqual([]);
  });
});

describe('orderByIds', () => {
  it('restores relevance order from the ID-first search', () => {
    const hydrated = [
      customer({ id: 'a' }),
      customer({ id: 'b' }),
      customer({ id: 'c' }),
    ];
    expect(orderByIds(hydrated, ['c', 'a', 'b']).map((c) => c.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('drops ids that did not hydrate rather than emitting holes', () => {
    const hydrated = [customer({ id: 'a' })];
    expect(orderByIds(hydrated, ['a', 'missing']).map((c) => c.id)).toEqual([
      'a',
    ]);
  });
});
