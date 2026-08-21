/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import { useHistory, useRouteMatch, Route, Switch } from 'react-router-dom';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import DataTable from '@commercetools-uikit/data-table';
import {
  usePaginationState,
  useDataTableSortingState,
} from '@commercetools-uikit/hooks';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import { Pagination } from '@commercetools-uikit/pagination';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import type { Customer } from '@commercetools/platform-sdk';
import { FALLBACK_SCAN_LIMIT } from '../../customer-search';
import {
  useCustomerActions,
  useCustomerSearch,
} from '../../hooks/use-customers';
import { useSession } from '../../session/session-context';
import { toCustomerRef } from '../customer-picker';
import { formatDate, fullName, getErrorMessage } from '../../utils';
import AccountScopeToggle from '../account-scope-toggle';
import CustomerDashboard from './customer-dashboard';

const columns = [
  { key: 'lastName', label: 'Name', isSortable: true },
  { key: 'lowercaseEmail', label: 'Email', isSortable: true },
  { key: 'customerNumber', label: 'Customer #' },
  { key: 'createdAt', label: 'Created', isSortable: true },
];

const CustomersList = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  const { selectCustomer } = useSession();
  const { page, perPage } = usePaginationState();
  const tableSorting = useDataTableSortingState({
    key: 'createdAt',
    order: 'desc',
  });
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [notice, setNotice] = useState<string>();

  const { results, total, mode, loading, error } = useCustomerSearch(term, {
    limit: perPage.value,
    offset: (page.value - 1) * perPage.value,
    sort: `${tableSorting.value.key} ${tableSorting.value.order}`,
  });
  const { create } = useCustomerActions();

  /** Open the in-app customer dashboard (also sets the global current customer). */
  const openCustomer = (customer: Customer) => {
    selectCustomer(toCustomerRef(customer));
    push(`${match.url}/${customer.id}`);
  };

  const onCreate = async () => {
    try {
      const { customer } = await create({
        email: newEmail.trim(),
        password: '123',
      });
      setCreating(false);
      setNewEmail('');
      openCustomer(customer);
    } catch (e) {
      setNotice(getErrorMessage(e));
    }
  };

  return (
    <Spacings.Stack scale="l">
      <Spacings.Inline
        scale="m"
        alignItems="center"
        justifyContent="space-between"
      >
        <Spacings.Inline scale="m" alignItems="center">
          <Text.Headline as="h2">Customers</Text.Headline>
          <AccountScopeToggle />
        </Spacings.Inline>
        <SecondaryButton
          label="New customer"
          onClick={() => setCreating((v) => !v)}
        />
      </Spacings.Inline>

      {creating && (
        <Spacings.Inline scale="s" alignItems="center">
          <TextInput
            value={newEmail}
            placeholder="email@example.com"
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <PrimaryButton
            label="Create (password: 123)"
            onClick={onCreate}
            isDisabled={!newEmail.includes('@')}
          />
        </Spacings.Inline>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          page.onChange(1);
          setTerm(input);
        }}
      >
        <Spacings.Inline scale="s" alignItems="center">
          <TextInput
            value={input}
            placeholder="Search by email, name, customer # or id"
            onChange={(e) => setInput(e.target.value)}
          />
          <PrimaryButton
            label="Search"
            onClick={() => {
              page.onChange(1);
              setTerm(input);
            }}
          />
          {term && (
            <SecondaryButton
              label="Clear"
              onClick={() => {
                setInput('');
                setTerm('');
              }}
            />
          )}
        </Spacings.Inline>
      </form>

      {notice && (
        <ContentNotification type="error">
          <Text.Body>{notice}</Text.Body>
        </ContentNotification>
      )}
      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}

      {!loading && mode === 'scan' && (
        <Text.Detail tone="secondary">
          Customer Search indexing is off for this Project, so this searched the
          most recent {FALLBACK_SCAN_LIMIT} customers directly. Activate it in
          Merchant Center → Customers to search the whole Project by relevance.
        </Text.Detail>
      )}

      {!loading && results.length === 0 && (
        <ContentNotification type="info">
          <Text.Body>No customers found.</Text.Body>
        </ContentNotification>
      )}

      {results.length > 0 && (
        <Spacings.Stack scale="m">
          <DataTable<Customer>
            columns={columns}
            rows={results}
            sortedBy={tableSorting.value.key}
            sortDirection={tableSorting.value.order}
            onSortChange={tableSorting.onChange}
            onRowClick={(row) => openCustomer(row)}
            itemRenderer={(item, column) => {
              switch (column.key) {
                case 'lastName':
                  return fullName(item);
                case 'lowercaseEmail':
                  return item.email;
                case 'customerNumber':
                  return item.customerNumber ?? '—';
                case 'createdAt':
                  return formatDate(item.createdAt);
                default:
                  return null;
              }
            }}
          />
          <Pagination
            page={page.value}
            onPageChange={page.onChange}
            perPage={perPage.value}
            onPerPageChange={perPage.onChange}
            totalItems={total}
          />
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
CustomersList.displayName = 'CustomersList';

/**
 * Customers module router. A customer id in the URL shows the full-screen
 * Customer Dashboard (detail page); otherwise the searchable list. Routing
 * between them (rather than appending the detail below the list) keeps the
 * detail view filling the screen with no list chrome above it.
 */
const Customers = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:id`}>
        <CustomerDashboard onClose={() => push(match.url)} />
      </SuspendedRoute>
      <Route>
        <CustomersList />
      </Route>
    </Switch>
  );
};
Customers.displayName = 'Customers';

export default Customers;
