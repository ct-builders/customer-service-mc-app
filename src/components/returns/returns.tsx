/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useHistory } from 'react-router-dom';
import DataTable from '@commercetools-uikit/data-table';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import type { Order } from '@commercetools/platform-sdk';
import { useOrdersWithReturns } from '../../hooks/use-orders';
import { useAppBase } from '../../sdk/use-app-base';
import { formatDate, getErrorMessage } from '../../utils';
import StatusStamp from '../status-stamp';

const columns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'returns', label: 'Return items' },
  { key: 'refunds', label: 'Refunded' },
  { key: 'modified', label: 'Last updated' },
  { key: 'state', label: 'Order' },
];

const Returns = () => {
  const { push } = useHistory();
  const appBase = useAppBase();
  const { results, loading, error } = useOrdersWithReturns();

  return (
    <Spacings.Stack scale="l">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">Returns &amp; Refunds</Text.Headline>
        <Text.Detail tone="secondary">
          Orders with returns on file. Open an order to file new returns or
          issue refunds.
        </Text.Detail>
      </Spacings.Stack>

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}

      {!loading && results.length === 0 && (
        <ContentNotification type="info">
          <Text.Body>No orders have returns yet.</Text.Body>
        </ContentNotification>
      )}

      {results.length > 0 && (
        <DataTable<Order>
          columns={columns}
          rows={results}
          onRowClick={(row) => push(`${appBase}/orders/${row.id}`)}
          itemRenderer={(item, column) => {
            const items = item.returnInfo?.flatMap((r) => r.items) ?? [];
            switch (column.key) {
              case 'orderNumber':
                return item.orderNumber ?? item.id.slice(0, 8);
              case 'customer':
                return item.customerEmail ?? '—';
              case 'returns':
                return items.reduce((sum, r) => sum + r.quantity, 0);
              case 'refunds':
                return items.filter((r) => r.paymentState === 'Refunded')
                  .length;
              case 'modified':
                return formatDate(item.lastModifiedAt);
              case 'state':
                return <StatusStamp value={item.orderState} />;
              default:
                return null;
            }
          }}
        />
      )}
    </Spacings.Stack>
  );
};
Returns.displayName = 'Returns';

export default Returns;
