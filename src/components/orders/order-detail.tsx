/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@commercetools-uikit/card';
import DataTable from '@commercetools-uikit/data-table';
import FlatButton from '@commercetools-uikit/flat-button';
import Grid from '@commercetools-uikit/grid';
import { BackIcon } from '@commercetools-uikit/icons';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import NumberInput from '@commercetools-uikit/number-input';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import type { Order, OrderUpdateAction } from '@commercetools/platform-sdk';
import { useOrder, useOrderActions } from '../../hooks/use-orders';
import { orderLines, type OrderLine } from '../../order-lines';
import { useCtp } from '../../sdk/use-ctp';
import {
  formatAddress,
  formatDateTime,
  formatMoney,
  getErrorMessage,
} from '../../utils';
import StatusStamp from '../status-stamp';

const ORDER_STATES = ['Open', 'Confirmed', 'Complete', 'Cancelled'];
const SHIPMENT_STATES = [
  'Pending',
  'Ready',
  'Shipped',
  'Delivered',
  'Backorder',
];
const PAYMENT_STATES = [
  'Pending',
  'BalanceDue',
  'Paid',
  'Failed',
  'CreditOwed',
];

const COMMENTS_CONTAINER = 'csr-order-comments';
type TComment = { author: string; body: string; createdAt: string };

const lineItemColumns = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'price', label: 'Unit price' },
  { key: 'qty', label: 'Qty' },
  { key: 'total', label: 'Line total' },
];

const StateControl = ({
  label,
  value,
  options,
  onApply,
}: {
  label: string;
  value?: string;
  options: string[];
  onApply: (next: string) => void;
}) => {
  const [next, setNext] = useState(value ?? options[0]);
  return (
    <Spacings.Stack scale="xs">
      <Text.Detail tone="secondary">{label}</Text.Detail>
      <Spacings.Inline scale="s" alignItems="center">
        <SelectInput
          value={next}
          options={options.map((o) => ({ value: o, label: o }))}
          onChange={(e) => setNext(e.target.value as string)}
        />
        <SecondaryButton label="Apply" onClick={() => onApply(next)} />
      </Spacings.Inline>
    </Spacings.Stack>
  );
};

const OrderDetail = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { order, loading, error, refetch } = useOrder(id);
  const { update, addReturn } = useOrderActions();
  const { get, post } = useCtp();

  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<TComment[]>([]);
  const [commentBody, setCommentBody] = useState('');

  /**
   * Both kinds of line, in one shape.
   *
   * Reading `order.lineItems` alone showed an EMPTY items table, a subtotal of 0
   * and an empty return-filing list for any project whose money lives in
   * CustomLineItems — every order in a project whose catalog is not in
   * commercetools. See src/order-lines.ts.
   */
  const lines = useMemo(() => (order ? orderLines(order) : []), [order]);

  const loadComments = useCallback(() => {
    get<{ value: { notes: TComment[] } }>(
      `/custom-objects/${COMMENTS_CONTAINER}/${id}`
    )
      .then((co) => setComments(co.value?.notes ?? []))
      .catch(() => setComments([]));
  }, [get, id]);

  useEffect(() => loadComments(), [loadComments]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setNotice(undefined);
    try {
      await fn();
      setNotice(message);
      refetch();
    } catch (e) {
      setNotice(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = (actions: OrderUpdateAction[], message: string) =>
    order && run(() => update(order, actions), message);

  const onAddComment = () => {
    if (!commentBody.trim()) return;
    const note: TComment = {
      author: 'CSR',
      body: commentBody.trim(),
      createdAt: new Date().toISOString(),
    };
    const notes = [note, ...comments];
    run(
      () =>
        post(`/custom-objects`, {
          container: COMMENTS_CONTAINER,
          key: id,
          value: { notes },
        }),
      'Comment added.'
    ).then(() => {
      setComments(notes);
      setCommentBody('');
    });
  };

  /**
   * File a return against either kind of line.
   *
   * ReturnItemDraft takes `lineItemId` OR `customLineItemId`, so keying this on
   * lineItemId alone made returns impossible — not merely awkward — on an order
   * whose lines are all custom.
   */
  const fileReturn = (item: OrderLine) => {
    const quantity = returnQty[item.id] ?? 0;
    if (!order || quantity <= 0) return;
    run(
      () =>
        addReturn(order, [
          {
            quantity,
            ...(item.kind === 'customLineItem'
              ? { customLineItemId: item.id }
              : { lineItemId: item.id }),
            shipmentState: 'Returned',
          },
        ]),
      `Return filed for ${quantity} × ${item.name}.`
    );
  };

  const markRefunded = (returnItemId: string) =>
    apply(
      [
        {
          action: 'setReturnPaymentState',
          returnItemId,
          paymentState: 'Refunded',
        },
      ],
      'Return marked as refunded.'
    );

  const returns = order?.returnInfo?.flatMap((ri) => ri.items) ?? [];

  return (
    <Spacings.Stack scale="l">
      <FlatButton
        label="Back to orders"
        icon={<BackIcon />}
        onClick={onClose}
      />

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}
      {notice && (
        <ContentNotification type="info">
          <Text.Body>{notice}</Text.Body>
        </ContentNotification>
      )}

      {order && (
        <Spacings.Stack scale="l">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text.Headline as="h2">
              Order {order.orderNumber ?? order.id.slice(0, 8)}
            </Text.Headline>
            <Spacings.Inline scale="s" alignItems="center">
              <StatusStamp value={order.orderState} />
              <StatusStamp value={order.paymentState} />
              <StatusStamp value={order.shipmentState} />
            </Spacings.Inline>
          </Spacings.Inline>

          <Card theme="light" type="raised">
            <Grid
              gridGap="16px"
              gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
            >
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Customer</Text.Detail>
                <Text.Body>{order.customerEmail ?? '—'}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Placed</Text.Detail>
                <Text.Body>{formatDateTime(order.createdAt)}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">
                  Order total (incl. tax)
                </Text.Detail>
                <Text.Body isBold>
                  {formatMoney(
                    order.taxedPrice?.totalGross ?? order.totalPrice
                  )}
                </Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Shipping address</Text.Detail>
                <Text.Body>{formatAddress(order.shippingAddress)}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Billing address</Text.Detail>
                <Text.Body>{formatAddress(order.billingAddress)}</Text.Body>
              </Spacings.Stack>
            </Grid>
          </Card>

          <Spacings.Stack scale="s">
            <Text.Subheadline as="h4">Line items</Text.Subheadline>
            <DataTable<OrderLine>
              columns={lineItemColumns}
              rows={lines}
              itemRenderer={(item, column) => {
                const money = (centAmount: number) => ({
                  type: 'centPrecision' as const,
                  currencyCode: item.currencyCode,
                  centAmount,
                  fractionDigits: item.fractionDigits,
                });
                switch (column.key) {
                  case 'name':
                    return item.variant
                      ? `${item.name} — ${item.variant}`
                      : item.name;
                  case 'sku':
                    return item.sku || '—';
                  case 'price': {
                    // Show the effective (discounted) unit price with the list
                    // price struck through when a discount applied.
                    const qty = item.quantity || 1;
                    const unitCents = Math.round(item.totalCentAmount / qty);
                    const isDiscounted = unitCents < item.unitCentAmount;
                    return isDiscounted ? (
                      <span>
                        <span
                          style={{
                            textDecoration: 'line-through',
                            opacity: 0.55,
                            marginRight: 6,
                          }}
                        >
                          {formatMoney(money(item.unitCentAmount))}
                        </span>
                        {formatMoney(money(unitCents))}
                      </span>
                    ) : (
                      formatMoney(money(item.unitCentAmount))
                    );
                  }
                  case 'qty':
                    return item.quantity;
                  case 'total':
                    return formatMoney(money(item.totalCentAmount));
                  default:
                    return null;
                }
              }}
            />
          </Spacings.Stack>

          {(() => {
            const cur = order.totalPrice.currencyCode;
            const money = (centAmount: number) => ({
              type: 'centPrecision' as const,
              currencyCode: cur,
              centAmount,
              fractionDigits: 2,
            });
            const itemsNet = lines.reduce((s, li) => s + li.totalCentAmount, 0);
            const orderDisc =
              order.discountOnTotalPrice?.discountedAmount?.centAmount ?? 0;
            const ship = order.shippingInfo;
            const shipMoney = ship?.discountedPrice?.value ?? ship?.price;
            const shipCents = shipMoney?.centAmount ?? 0;
            const tax = order.taxedPrice?.totalTax;
            const gross = order.taxedPrice?.totalGross ?? order.totalPrice;
            const Row = ({
              label,
              value,
              bold,
            }: {
              label: string;
              value: string;
              bold?: boolean;
            }) => (
              <Spacings.Inline
                alignItems="center"
                justifyContent="space-between"
              >
                <Text.Body isBold={bold}>{label}</Text.Body>
                <Text.Body isBold={bold}>{value}</Text.Body>
              </Spacings.Inline>
            );
            return (
              <Card theme="light" type="raised">
                <Spacings.Stack scale="s">
                  <Text.Subheadline as="h4">Totals</Text.Subheadline>
                  <Row
                    label="Items subtotal"
                    value={formatMoney(money(itemsNet))}
                  />
                  {orderDisc > 0 && (
                    <Row
                      label="Order discount"
                      value={`−${formatMoney(money(orderDisc))}`}
                    />
                  )}
                  <Row
                    label="Shipping"
                    value={shipCents === 0 ? 'Free' : formatMoney(shipMoney)}
                  />
                  {tax && <Row label="Tax" value={formatMoney(tax)} />}
                  <Row
                    label="Total (incl. tax)"
                    value={formatMoney(gross)}
                    bold
                  />
                </Spacings.Stack>
              </Card>
            );
          })()}

          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Text.Subheadline as="h4">Order actions</Text.Subheadline>
              <Grid
                gridGap="16px"
                gridTemplateColumns="repeat(auto-fill, minmax(240px, 1fr))"
              >
                <StateControl
                  label="Order state"
                  value={order.orderState}
                  options={ORDER_STATES}
                  onApply={(next) =>
                    apply(
                      [
                        {
                          action: 'changeOrderState',
                          orderState: next as Order['orderState'],
                        },
                      ],
                      `Order state set to ${next}.`
                    )
                  }
                />
                <StateControl
                  label="Shipment state"
                  value={order.shipmentState ?? undefined}
                  options={SHIPMENT_STATES}
                  onApply={(next) =>
                    apply(
                      [{ action: 'changeShipmentState', shipmentState: next }],
                      `Shipment state set to ${next}.`
                    )
                  }
                />
                <StateControl
                  label="Payment state"
                  value={order.paymentState ?? undefined}
                  options={PAYMENT_STATES}
                  onApply={(next) =>
                    apply(
                      [{ action: 'changePaymentState', paymentState: next }],
                      `Payment state set to ${next}.`
                    )
                  }
                />
              </Grid>
            </Spacings.Stack>
          </Card>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Text.Subheadline as="h4">Returns &amp; refunds</Text.Subheadline>
              {returns.length > 0 && (
                <Spacings.Stack scale="xs">
                  {returns.map((r) => (
                    <Spacings.Inline
                      key={r.id}
                      scale="s"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text.Body>
                        Return {r.id.slice(0, 8)} · qty {r.quantity} ·{' '}
                        {r.shipmentState}
                      </Text.Body>
                      <Spacings.Inline scale="s" alignItems="center">
                        <StatusStamp value={r.paymentState} />
                        {r.paymentState !== 'Refunded' && (
                          <SecondaryButton
                            label="Mark refunded"
                            isDisabled={busy}
                            onClick={() => markRefunded(r.id)}
                          />
                        )}
                      </Spacings.Inline>
                    </Spacings.Inline>
                  ))}
                </Spacings.Stack>
              )}
              <Text.Detail tone="secondary">File a return</Text.Detail>
              {lines.map((item) => (
                <Spacings.Inline key={item.id} scale="s" alignItems="center">
                  <div style={{ minWidth: 220 }}>
                    <Text.Body>{item.name}</Text.Body>
                  </div>
                  <div style={{ width: 90 }}>
                    <NumberInput
                      min={0}
                      max={item.quantity}
                      value={returnQty[item.id] ?? 0}
                      onChange={(e) =>
                        setReturnQty((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <SecondaryButton
                    label={`Return (of ${item.quantity})`}
                    isDisabled={busy || (returnQty[item.id] ?? 0) <= 0}
                    onClick={() => fileReturn(item)}
                  />
                </Spacings.Inline>
              ))}
            </Spacings.Stack>
          </Card>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Text.Subheadline as="h4">CSR comments</Text.Subheadline>
              <Spacings.Inline scale="s" alignItems="center">
                <TextInput
                  value={commentBody}
                  placeholder="Log a note about this order / contact"
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <PrimaryButton
                  label="Add comment"
                  isDisabled={busy || !commentBody.trim()}
                  onClick={onAddComment}
                />
              </Spacings.Inline>
              {comments.map((c, i) => (
                <Spacings.Stack key={i} scale="xs">
                  <Text.Detail tone="secondary">
                    {c.author} · {formatDateTime(c.createdAt)}
                  </Text.Detail>
                  <Text.Body>{c.body}</Text.Body>
                </Spacings.Stack>
              ))}
            </Spacings.Stack>
          </Card>
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
OrderDetail.displayName = 'OrderDetail';

export default OrderDetail;
