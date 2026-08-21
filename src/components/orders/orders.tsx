/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import {
  useHistory,
  useParams,
  useRouteMatch,
  Route,
  Switch,
} from 'react-router-dom';
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
import Stamp from '@commercetools-uikit/stamp';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import type { Order } from '@commercetools/platform-sdk';
import { useOrderSearch } from '../../hooks/use-orders';
import { useSession } from '../../session/session-context';
import {
  formatDate,
  formatMoney,
  fullName,
  getErrorMessage,
} from '../../utils';
import StatusStamp from '../status-stamp';
import OrderDetail from './order-detail';

const columns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customerEmail', label: 'Customer' },
  { key: 'createdAt', label: 'Date', isSortable: true },
  { key: 'totalPrice', label: 'Total' },
  { key: 'orderState', label: 'Order', isSortable: true },
  { key: 'paymentState', label: 'Payment', isSortable: true },
  { key: 'shipmentState', label: 'Shipment', isSortable: true },
];

const OrdersList = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  const { currentCustomer } = useSession();
  const { page, perPage } = usePaginationState();
  const tableSorting = useDataTableSortingState({
    key: 'createdAt',
    order: 'desc',
  });
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');

  // When a customer is current (and the CSR hasn't typed a search), scope the
  // Orders view to that customer's orders via a customerId query.
  const scopeCustomerId =
    !term && currentCustomer ? currentCustomer.id : undefined;
  const { results, total, loading, error } = useOrderSearch(term, {
    limit: perPage.value,
    offset: (page.value - 1) * perPage.value,
    sort: `${tableSorting.value.key} ${tableSorting.value.order}`,
    customerId: scopeCustomerId,
  });

  return (
    <Spacings.Stack scale="l">
      <Spacings.Inline scale="s" alignItems="center">
        <Text.Headline as="h2">Orders</Text.Headline>
        {scopeCustomerId && (
          <Stamp
            isCondensed
            tone="information"
            label={`for ${fullName(currentCustomer!)}`}
          />
        )}
      </Spacings.Inline>

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
            placeholder="Search by order # or customer email"
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

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}

      {!loading && results.length === 0 && (
        <ContentNotification type="info">
          <Text.Body>No orders found.</Text.Body>
        </ContentNotification>
      )}

      {results.length > 0 && (
        <Spacings.Stack scale="m">
          <DataTable<Order>
            columns={columns}
            rows={results}
            sortedBy={tableSorting.value.key}
            sortDirection={tableSorting.value.order}
            onSortChange={tableSorting.onChange}
            onRowClick={(row) => push(`${match.url}/${row.id}`)}
            itemRenderer={(item, column) => {
              switch (column.key) {
                case 'orderNumber':
                  return item.orderNumber ?? item.id.slice(0, 8);
                case 'customerEmail':
                  return item.customerEmail ?? '—';
                case 'createdAt':
                  return formatDate(item.createdAt);
                case 'totalPrice':
                  return formatMoney(
                    item.taxedPrice?.totalGross ?? item.totalPrice
                  );
                case 'orderState':
                  return <StatusStamp value={item.orderState} />;
                case 'paymentState':
                  return <StatusStamp value={item.paymentState} />;
                case 'shipmentState':
                  return <StatusStamp value={item.shipmentState} />;
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
OrdersList.displayName = 'OrdersList';

/** Reads the :id param and renders the shared OrderDetail full-screen. */
const OrderDetailRoute = ({ onClose }: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  return <OrderDetail id={id} onClose={onClose} />;
};

/**
 * Orders module router. An order id in the URL shows the full-screen Order
 * detail; otherwise the searchable list (scoped to the current customer).
 */
const Orders = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:id`}>
        <OrderDetailRoute onClose={() => push(match.url)} />
      </SuspendedRoute>
      <Route>
        <OrdersList />
      </Route>
    </Switch>
  );
};
Orders.displayName = 'Orders';

export default Orders;
