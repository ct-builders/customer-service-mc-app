/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { InfoModalPage } from '@commercetools-frontend/application-components';
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
  useCustomer,
  useCustomerBusinessUnits,
} from '../../hooks/use-customers';
import {
  useAssociateRoleNames,
  useBusinessUnitNames,
  useStoreNames,
} from '../../hooks/use-display-names';
import { useEnsureTicket } from '../../hooks/use-ensure-ticket';
import { useCustomerOrders } from '../../hooks/use-orders';
import {
  useStoreCredit,
  useTicketActions,
  useTickets,
} from '../../hooks/use-tickets';
import { useAppBase } from '../../sdk/use-app-base';
import { useCurrentUser } from '../../sdk/use-current-user';
import { useSession } from '../../session/session-context';
import {
  formatDate,
  formatMoney,
  fullName,
  getErrorMessage,
} from '../../utils';
import { shopPagePath } from '../../csr-launch';
import { toCustomerRef } from '../customer-picker';
import StatusStamp from '../status-stamp';
import OrderDetail from '../orders/order-detail';

const orderColumns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'createdAt', label: 'Date' },
  { key: 'total', label: 'Total' },
  { key: 'state', label: 'Order' },
  { key: 'payment', label: 'Payment' },
];

/** One label/value line inside the B2B account panel. */
const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Spacings.Inline scale="xs" alignItems="center">
    <Text.Detail tone="secondary">{label}:</Text.Detail>
    <Text.Detail>{value}</Text.Detail>
  </Spacings.Inline>
);

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Card theme="light" type="raised">
    <Spacings.Stack scale="xs">
      <Text.Headline as="h3">{value}</Text.Headline>
      <Text.Detail tone="secondary">{label}</Text.Detail>
    </Spacings.Stack>
  </Card>
);

const CustomerDashboard = ({ onClose }: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const { push } = useHistory();
  const appBase = useAppBase();
  const projectKey = useApplicationContext<string>(
    (ctx) => ctx.project?.key ?? ''
  );
  const { currentCustomer, selectCustomer, setCurrentTicket } = useSession();
  const user = useCurrentUser();

  const { customer, loading, error } = useCustomer(id);
  const { results: orders, total: orderTotal } = useCustomerOrders(id);
  const { isB2B, units } = useCustomerBusinessUnits(id);
  // Stores, associate roles and parent units are key-only references, so the names have
  // to be resolved — otherwise the panel shows `us-large-customers` and `buyer`.
  const storeName = useStoreNames();
  const roleName = useAssociateRoleNames();
  const unitName = useBusinessUnitNames();
  const { credit } = useStoreCredit(id);
  const { tickets } = useTickets();
  const { save, allocateTicketNumber } = useTicketActions();
  const { ensureTicket } = useEnsureTicket();

  const [openOrderId, setOpenOrderId] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // currentCustomer is the single source of truth for "who". Seed it from the
  // loaded customer only when nothing is selected yet (deep-link / first visit)
  // — do NOT override an existing selection, or it fights the sync effect below.
  useEffect(() => {
    if (customer && !currentCustomer) selectCustomer(toCustomerRef(customer));
  }, [customer, currentCustomer, selectCustomer]);

  // Keep the dashboard in sync with the selected customer: if a different
  // customer becomes current (status-bar "Change", or a ticket for another
  // customer) while this dashboard is open, navigate here — deterministically,
  // independent of whether the picker's own navigation landed.
  useEffect(() => {
    if (currentCustomer && currentCustomer.id !== id) {
      push(`${appBase}/customers/${currentCustomer.id}`);
    }
  }, [currentCustomer, id, push, appBase]);

  const myTickets = tickets.filter(
    (t) =>
      t.value?.customerId === id || t.value?.customerEmail === customer?.email
  );
  const openTickets = myTickets.filter((t) => t.value?.status !== 'resolved');
  const spend = orders.reduce(
    (sum, o) =>
      sum +
      (o.taxedPrice?.totalGross?.centAmount ?? o.totalPrice?.centAmount ?? 0),
    0
  );
  const currency = orders[0]?.totalPrice?.currencyCode ?? 'USD';

  const createTicket = async () => {
    if (!customer) return;
    const key = `ticket-${Date.now()}`;
    try {
      const ticketNumber = await allocateTicketNumber();
      const created = await save(key, {
        ticketNumber,
        subject: `Ticket — ${fullName(customer)}`,
        status: 'open',
        priority: 'medium',
        assignee: user.email,
        customerId: customer.id,
        customerEmail: customer.email,
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
        label="Back to customers"
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

      {customer && (
        <Spacings.Stack scale="l">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Spacings.Inline scale="s" alignItems="center">
              <Text.Headline as="h2">{fullName(customer)}</Text.Headline>
              <Text.Detail tone="secondary">{customer.email}</Text.Detail>
              {isB2B && (
                <Stamp
                  isCondensed
                  tone="primary"
                  label={`B2B: ${
                    units[0]?.name || units[0]?.key || 'Business unit'
                  }`}
                />
              )}
            </Spacings.Inline>
            <SecondaryButton
              label="Open full profile in MC ↗"
              onClick={() =>
                window.open(
                  `/${projectKey}/customers/${customer.id}/general`,
                  '_blank'
                )
              }
            />
          </Spacings.Inline>

          {/* Stats */}
          <Grid
            gridGap="16px"
            gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))"
          >
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
            <Stat
              label="Store credit"
              value={
                credit?.value
                  ? formatMoney({
                      type: 'centPrecision',
                      currencyCode: credit.value.currencyCode,
                      centAmount: credit.value.amount,
                      fractionDigits: 2,
                    })
                  : '—'
              }
            />
            <Stat label="Member since" value={formatDate(customer.createdAt)} />
          </Grid>

          {/* The B2B half of the customer. A CSR taking a call needs to see which
              company the caller buys for, on which store's pricing, and what they
              are allowed to do — the roles are the whole permission story. Before
              this the account only surfaced as a stamp with the unit's name. */}
          {isB2B && (
            <Card theme="light" type="raised">
              <Spacings.Stack scale="s">
                <Text.Subheadline as="h4">
                  {units.length > 1
                    ? `B2B account (${units.length} units)`
                    : 'B2B account'}
                </Text.Subheadline>
                {units.map((unit) => {
                  const roles =
                    unit.associates
                      ?.find((a) => a.customer?.id === customer.id)
                      ?.associateRoleAssignments?.map((r) =>
                        roleName(r.associateRole?.key)
                      )
                      .filter(Boolean) ?? [];
                  const stores = (unit.stores ?? [])
                    .map((st) => storeName(st.key))
                    .filter(Boolean);
                  return (
                    <Spacings.Stack scale="xs" key={unit.id}>
                      <Spacings.Inline scale="s" alignItems="center">
                        <FlatButton
                          label={unit.name || unit.key}
                          onClick={() =>
                            push(`${appBase}/businesses/${unit.id}`)
                          }
                        />
                        <Stamp
                          isCondensed
                          tone="information"
                          label={unit.unitType}
                        />
                        {roles.map((role) => (
                          <Stamp
                            key={role}
                            isCondensed
                            tone="primary"
                            label={String(role)}
                          />
                        ))}
                      </Spacings.Inline>
                      <Spacings.Inline scale="m" alignItems="center">
                        <Fact label="Key" value={unit.key} />
                        <Fact
                          label="Store"
                          value={stores.length ? stores.join(', ') : '—'}
                        />
                        <Fact
                          label="People"
                          value={unit.associates?.length ?? 0}
                        />
                        {unit.parentUnit?.key && (
                          <Fact
                            label="Parent"
                            value={unitName(unit.parentUnit.key)}
                          />
                        )}
                        <Fact
                          label="Contact"
                          value={
                            unit.contactEmail ||
                            unit.addresses?.[0]?.city ||
                            '—'
                          }
                        />
                      </Spacings.Inline>
                    </Spacings.Stack>
                  );
                })}
              </Spacings.Stack>
            </Card>
          )}

          {/* Common next steps */}
          <Card theme="light" type="raised">
            <Spacings.Stack scale="s">
              <Text.Subheadline as="h4">Common next steps</Text.Subheadline>
              <Spacings.Inline scale="s">
                <PrimaryButton
                  label="Place order for customer"
                  onClick={() => {
                    void ensureTicket(
                      'Opened storefront to place an order (CSR mode).'
                    );
                    push(
                      shopPagePath(appBase, {
                        customerId: customer.id,
                        label: fullName(customer),
                        isB2B,
                        businessUnitKey: units[0]?.key,
                      })
                    );
                  }}
                />
                <SecondaryButton label="New ticket" onClick={createTicket} />
                <SecondaryButton
                  label="Wish lists"
                  onClick={() => push(`${appBase}/lists`)}
                />
                <SecondaryButton
                  label="File a return"
                  onClick={() => push(`${appBase}/returns`)}
                />
              </Spacings.Inline>
              {isB2B && (
                <Text.Detail tone="secondary">
                  This is a B2B account ({units.length} business unit
                  {units.length === 1 ? '' : 's'}) — assisted orders open the
                  B2B storefront.
                </Text.Detail>
              )}
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
                onRowClick={(row) => setOpenOrderId(row.id)}
                itemRenderer={(item, column) => {
                  switch (column.key) {
                    case 'orderNumber':
                      return item.orderNumber ?? item.id.slice(0, 8);
                    case 'createdAt':
                      return formatDate(item.createdAt);
                    case 'total':
                      return formatMoney(
                        item.taxedPrice?.totalGross ?? item.totalPrice
                      );
                    case 'state':
                      return <StatusStamp value={item.orderState} />;
                    case 'payment':
                      return <StatusStamp value={item.paymentState} />;
                    default:
                      return null;
                  }
                }}
              />
            )}
          </Spacings.Stack>
        </Spacings.Stack>
      )}

      <InfoModalPage
        title="Order details"
        isOpen={Boolean(openOrderId)}
        onClose={() => setOpenOrderId(undefined)}
      >
        {openOrderId && (
          <OrderDetail
            id={openOrderId}
            onClose={() => setOpenOrderId(undefined)}
          />
        )}
      </InfoModalPage>
    </Spacings.Stack>
  );
};
CustomerDashboard.displayName = 'CustomerDashboard';

export default CustomerDashboard;
