/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useHistory } from 'react-router-dom';
import Card from '@commercetools-uikit/card';
import Grid from '@commercetools-uikit/grid';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { useCurrentUser } from '../../sdk/use-current-user';
import { useAppBase } from '../../sdk/use-app-base';
import { useSession } from '../../session/session-context';
import { useTickets } from '../../hooks/use-tickets';
import { useCustomerSearch } from '../../hooks/use-customers';
import { useOrderSearch, useOrdersWithReturns } from '../../hooks/use-orders';
import StatusStamp from '../status-stamp';

type Metric = {
  label: string;
  value: number;
  to: string;
  tone?: 'primary' | 'critical' | 'neutral';
};

const Tile = ({ metric, onClick }: { metric: Metric; onClick: () => void }) => (
  <div onClick={onClick} style={{ cursor: 'pointer' }}>
    <Card theme="light" type="raised">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">{metric.value}</Text.Headline>
        <Text.Detail tone="secondary">{metric.label}</Text.Detail>
      </Spacings.Stack>
    </Card>
  </div>
);

const Home = () => {
  const { push } = useHistory();
  const appBase = useAppBase();
  const user = useCurrentUser();
  const { recentCustomers } = useSession();
  const { tickets, loading } = useTickets();

  // Lightweight counts for headline metrics (limit:1 → we only need `total`).
  const { total: totalCustomers } = useCustomerSearch('', { limit: 1 });
  const { total: totalOrders } = useOrderSearch('', { limit: 1 });
  const { total: ordersWithReturns } = useOrdersWithReturns();

  const mine = tickets.filter((t) => t.value?.assignee === user.email);
  const open = tickets.filter((t) => t.value?.status === 'open');
  const pending = tickets.filter((t) => t.value?.status === 'pending');
  const resolved = tickets.filter((t) => t.value?.status === 'resolved');
  const highOpen = tickets.filter(
    (t) => t.value?.priority === 'high' && t.value?.status !== 'resolved'
  );
  const myOpen = mine.filter((t) => t.value?.status !== 'resolved');
  const unresolved = tickets.filter((t) => t.value?.status !== 'resolved');

  const metrics: Metric[] = [
    {
      label: 'My open tickets',
      value: myOpen.length,
      to: `${appBase}/tickets?mine=1&status=open`,
    },
    {
      label: 'Open tickets',
      value: open.length,
      to: `${appBase}/tickets?status=open`,
    },
    {
      label: 'Pending tickets',
      value: pending.length,
      to: `${appBase}/tickets?status=pending`,
    },
    {
      label: 'High priority (unresolved)',
      value: highOpen.length,
      to: `${appBase}/tickets?priority=high`,
    },
    {
      label: 'Unresolved tickets',
      value: unresolved.length,
      to: `${appBase}/tickets?status=open`,
    },
    {
      label: 'Resolved tickets',
      value: resolved.length,
      to: `${appBase}/tickets?status=resolved`,
    },
    {
      label: 'Total customers',
      value: totalCustomers,
      to: `${appBase}/customers`,
    },
    { label: 'Total orders', value: totalOrders, to: `${appBase}/orders` },
    {
      label: 'Orders with returns',
      value: ordersWithReturns,
      to: `${appBase}/returns`,
    },
    {
      label: 'My recent customers',
      value: recentCustomers.length,
      to: `${appBase}/customers`,
    },
  ];

  return (
    <Spacings.Stack scale="xl">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h1">Hello, {user.name}</Text.Headline>
        <Text.Subheadline as="h4">
          Your customer-service dashboard.
        </Text.Subheadline>
      </Spacings.Stack>

      {loading && <LoadingSpinner />}

      <Grid
        gridGap="16px"
        gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))"
      >
        {metrics.map((m) => (
          <Tile key={m.label} metric={m} onClick={() => push(m.to)} />
        ))}
      </Grid>

      <Spacings.Stack scale="s">
        <Text.Subheadline as="h4">My open tickets</Text.Subheadline>
        {!loading && myOpen.length === 0 && (
          <Text.Detail tone="secondary">
            Nothing assigned to you right now.
          </Text.Detail>
        )}
        {myOpen.slice(0, 6).map((t) => (
          <div
            key={t.key}
            onClick={() => push(`${appBase}/tickets/${t.key}`)}
            style={{ cursor: 'pointer' }}
          >
            <Card theme="light" type="flat">
              <Spacings.Inline
                scale="m"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text.Body isBold>{t.value?.subject ?? t.key}</Text.Body>
                <Spacings.Inline scale="s" alignItems="center">
                  <Text.Detail tone="secondary">
                    {t.value?.customerEmail ?? ''}
                  </Text.Detail>
                  <StatusStamp value={t.value?.priority} />
                  <StatusStamp value={t.value?.status} />
                </Spacings.Inline>
              </Spacings.Inline>
            </Card>
          </div>
        ))}
      </Spacings.Stack>
    </Spacings.Stack>
  );
};
Home.displayName = 'Home';

export default Home;
