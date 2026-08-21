/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import Card from '@commercetools-uikit/card';
import DataTable from '@commercetools-uikit/data-table';
import FlatButton from '@commercetools-uikit/flat-button';
import Grid from '@commercetools-uikit/grid';
import { BackIcon } from '@commercetools-uikit/icons';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Stamp from '@commercetools-uikit/stamp';
import Text from '@commercetools-uikit/text';
import type { Order } from '@commercetools/platform-sdk';
import { useParams, useHistory } from 'react-router-dom';
import {
  businessRef,
  useBusinessOrders,
  useBusinessUnit,
} from '../../hooks/use-businesses';
import { useTickets, useTicketActions } from '../../hooks/use-tickets';
import { useAppBase } from '../../sdk/use-app-base';
import { useCurrentUser } from '../../sdk/use-current-user';
import { useSession } from '../../session/session-context';
import { shopPagePath } from '../../csr-launch';
import { useEnsureTicket } from '../../hooks/use-ensure-ticket';
import { formatDate, formatMoney, getErrorMessage } from '../../utils';
import StatusStamp from '../status-stamp';

const orderColumns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'createdAt', label: 'Date' },
  { key: 'customer', label: 'Placed by' },
  { key: 'total', label: 'Total' },
  { key: 'state', label: 'Order' },
];

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Card theme="light" type="raised">
    <Spacings.Stack scale="xs">
      <Text.Headline as="h3">{value}</Text.Headline>
      <Text.Detail tone="secondary">{label}</Text.Detail>
    </Spacings.Stack>
  </Card>
);

const BusinessDashboard = ({ onClose }: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const { push } = useHistory();
  const appBase = useAppBase();
  const projectKey = useApplicationContext<string>(
    (ctx) => ctx.project?.key ?? ''
  );
  const { selectBusiness, setCurrentTicket } = useSession();
  const user = useCurrentUser();

  const { business, loading, error } = useBusinessUnit(id);
  const { results: orders, total: orderTotal } = useBusinessOrders(
    business?.key
  );
  const { tickets } = useTickets();
  const { save, allocateTicketNumber } = useTicketActions();

  const { ensureTicket } = useEnsureTicket();
  const [notice, setNotice] = useState<string>();

  // Opening a business makes it the global current business.
  useEffect(() => {
    if (business) selectBusiness(businessRef(business));
  }, [business, selectBusiness]);

  const bizTickets = tickets.filter(
    (t) =>
      t.value?.businessUnitId === id ||
      (business && t.value?.businessUnitKey === business.key)
  );
  const openTickets = bizTickets.filter((t) => t.value?.status !== 'resolved');
  const spend = orders.reduce(
    (s, o) =>
      s +
      (o.taxedPrice?.totalGross?.centAmount ?? o.totalPrice?.centAmount ?? 0),
    0
  );
  const currency = orders[0]?.totalPrice?.currencyCode ?? 'USD';
  const firstAssociateId = business?.associates?.[0]?.customer?.id;

  const createTicket = async () => {
    if (!business) return;
    const key = `ticket-${Date.now()}`;
    try {
      const ticketNumber = await allocateTicketNumber();
      const created = await save(key, {
        ticketNumber,
        subject: `Ticket — ${business.name}`,
        status: 'open',
        priority: 'medium',
        assignee: user.email,
        businessUnitId: business.id,
        businessUnitKey: business.key,
        businessUnitName: business.name,
        notes: [],
        createdAt: new Date().toISOString(),
      });
      setCurrentTicket(created);
      push(`${appBase}/tickets/${key}`);
    } catch (e) {
      setNotice(getErrorMessage(e));
    }
  };

  return (
    <Spacings.Stack scale="l">
      <FlatButton
        label="Back to businesses"
        icon={<BackIcon />}
        onClick={onClose}
      />

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {notice && (
        <ContentNotification type="error">
          <Text.Body>{notice}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}

      {business && (
        <Spacings.Stack scale="l">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Spacings.Inline scale="s" alignItems="center">
              <Text.Headline as="h2">{business.name}</Text.Headline>
              {/* The heading already carries the name; the stamp just marks it as a B2B
                  account. It used to repeat the raw key here, which reads as debug output. */}
              <Stamp isCondensed tone="primary" label="B2B" />
              {business.contactEmail && (
                <Text.Detail tone="secondary">
                  {business.contactEmail}
                </Text.Detail>
              )}
            </Spacings.Inline>
            <SecondaryButton
              label="Open full business unit in MC ↗"
              onClick={() =>
                window.open(
                  `/${projectKey}/business-units/${business.id}`,
                  '_blank'
                )
              }
            />
          </Spacings.Inline>

          <Grid
            gridGap="16px"
            gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))"
          >
            <Stat label="Members" value={business.associates?.length ?? 0} />
            <Stat label="Stores" value={business.stores?.length ?? 0} />
            <Stat label="Orders" value={orderTotal} />
            <Stat
              label="Spend (recent)"
              value={formatMoney({
                type: 'centPrecision',
                currencyCode: currency,
                centAmount: spend,
                fractionDigits: 2,
              })}
            />
            <Stat label="Open tickets" value={openTickets.length} />
          </Grid>

          {/* Common next steps — for the business */}
          <Card theme="light" type="raised">
            <Spacings.Stack scale="s">
              <Text.Subheadline as="h4">Common next steps</Text.Subheadline>
              <Spacings.Inline scale="s">
                <PrimaryButton
                  label="Place order in B2B storefront"
                  isDisabled={!firstAssociateId}
                  onClick={() => {
                    if (!firstAssociateId || !business) return;
                    void ensureTicket(
                      'Opened the B2B storefront to place an order (CSR mode).'
                    );
                    push(
                      shopPagePath(appBase, {
                        customerId: firstAssociateId,
                        label: business.name,
                        isB2B: true,
                        businessUnitKey: business.key,
                      })
                    );
                  }}
                />
                <SecondaryButton
                  label="New ticket for business"
                  onClick={createTicket}
                />
              </Spacings.Inline>
              <Text.Detail tone="secondary">
                {firstAssociateId
                  ? 'Opens the B2B storefront for this business unit (as one of its associates).'
                  : 'No associates on this business unit yet — add one to place orders.'}
              </Text.Detail>
            </Spacings.Stack>
          </Card>

          {/* Recent orders */}
          <Spacings.Stack scale="s">
            <Spacings.Inline
              scale="m"
              alignItems="center"
              justifyContent="space-between"
            >
              <Text.Subheadline as="h4">Recent orders</Text.Subheadline>
              {orderTotal > orders.length && (
                <FlatButton
                  label={`Search all ${orderTotal} orders`}
                  onClick={() => push(`${appBase}/orders`)}
                />
              )}
            </Spacings.Inline>
            {orders.length === 0 ? (
              <Text.Detail tone="secondary">No orders yet.</Text.Detail>
            ) : (
              <DataTable<Order>
                columns={orderColumns}
                rows={orders}
                itemRenderer={(item, column) => {
                  switch (column.key) {
                    case 'orderNumber':
                      return item.orderNumber ?? item.id.slice(0, 8);
                    case 'createdAt':
                      return formatDate(item.createdAt);
                    case 'customer':
                      return item.customerEmail ?? '—';
                    case 'total':
                      return formatMoney(
                        item.taxedPrice?.totalGross ?? item.totalPrice
                      );
                    case 'state':
                      return <StatusStamp value={item.orderState} />;
                    default:
                      return null;
                  }
                }}
              />
            )}
          </Spacings.Stack>

          {/* Business tickets */}
          <Spacings.Stack scale="s">
            <Text.Subheadline as="h4">
              Tickets ({bizTickets.length})
            </Text.Subheadline>
            {bizTickets.length === 0 ? (
              <Text.Detail tone="secondary">
                No tickets for this business yet.
              </Text.Detail>
            ) : (
              bizTickets.map((t) => (
                <Card key={t.key} theme="light" type="flat">
                  <Spacings.Inline scale="s" alignItems="center">
                    <Text.Body isBold>
                      {t.value?.ticketNumber
                        ? `#${t.value.ticketNumber} · `
                        : ''}
                      {t.value?.subject}
                    </Text.Body>
                    <StatusStamp value={t.value?.priority} />
                    <StatusStamp value={t.value?.status} />
                    <FlatButton
                      tone="primary"
                      label="Open"
                      onClick={() => {
                        setCurrentTicket(t);
                        push(`${appBase}/tickets/${t.key}`);
                      }}
                    />
                  </Spacings.Inline>
                </Card>
              ))
            )}
          </Spacings.Stack>
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
BusinessDashboard.displayName = 'BusinessDashboard';

export default BusinessDashboard;
