/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  Order,
  OrderPagedQueryResponse,
  OrderUpdateAction,
  ReturnItemDraft,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp, q } from '../sdk/use-ctp';

const PAGE = 25;

type SearchOpts = {
  limit?: number;
  offset?: number;
  sort?: string;
  customerId?: string;
};

/**
 * List/search orders with plain query predicates (scope: view_orders):
 * - a free-text `term` matches order number / customer email / id (exact),
 * - otherwise, when `customerId` is given, the customer's orders,
 * - otherwise the most recent orders.
 *
 * We deliberately do NOT use the Order Search API here: the docs state it "is
 * not intended for searching through a customer's order history", it only
 * indexes the last 3 months, and the MC API gateway's order-search proxy
 * additionally requires `manage_project_settings` (it also fronts reindex),
 * which this CSR app shouldn't hold.
 */
export const useOrderSearch = (term: string, opts: SearchOpts = {}) => {
  const { get } = useCtp();
  const trimmed = term.trim();
  const limit = opts.limit ?? PAGE;
  const offset = opts.offset ?? 0;
  const sort = opts.sort ?? 'createdAt desc';
  const customerId = opts.customerId;

  const { data, loading, error, refetch } = useAsyncData<{
    results: Order[];
    total: number;
  }>(async () => {
    let where = '';
    if (trimmed) {
      const esc = trimmed.replace(/"/g, '\\"');
      const preds = [`orderNumber = "${esc}"`, `customerEmail = "${esc}"`];
      if (/^[0-9a-f-]{36}$/i.test(esc)) preds.push(`id = "${esc}"`);
      where = `&where=${q(preds.join(' or '))}`;
    } else if (customerId) {
      where = `&where=${q(`customerId = "${customerId}"`)}`;
    }
    const r = await get<OrderPagedQueryResponse>(
      `/orders?limit=${limit}&offset=${offset}&sort=${q(sort)}${where}`
    );
    return { results: r.results ?? [], total: r.total ?? 0 };
  }, [trimmed, limit, offset, sort, customerId]);

  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  };
};

/** Orders that have at least one return on file (Returns overview). */
export const useOrdersWithReturns = () => {
  const { get } = useCtp();
  const { data, loading, error, refetch } =
    useAsyncData<OrderPagedQueryResponse>(
      () =>
        get(
          `/orders?limit=${PAGE}&sort=lastModifiedAt desc&where=${q(
            'returnInfo is not empty'
          )}`
        ),
      []
    );
  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  };
};

export const useCustomerOrders = (customerId?: string) => {
  const { get } = useCtp();
  const { data, loading, error } = useAsyncData<OrderPagedQueryResponse>(
    () =>
      get(
        `/orders?limit=${PAGE}&sort=createdAt desc&where=${q(
          `customerId = "${customerId}"`
        )}`
      ),
    [customerId],
    Boolean(customerId)
  );
  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    loading,
    error,
  };
};

export const useOrder = (orderId: string) => {
  const { get } = useCtp();
  const { data, loading, error, refetch } = useAsyncData<Order>(
    () => get(`/orders/${orderId}`),
    [orderId],
    Boolean(orderId)
  );
  return { order: data, loading, error, refetch };
};

export const useOrderActions = () => {
  const { post } = useCtp();

  const update = useCallback(
    (order: Pick<Order, 'id' | 'version'>, actions: OrderUpdateAction[]) =>
      post<Order>(`/orders/${order.id}`, { version: order.version, actions }),
    [post]
  );

  const addReturn = useCallback(
    (order: Pick<Order, 'id' | 'version'>, items: ReturnItemDraft[]) =>
      update(order, [{ action: 'addReturnInfo', items }]),
    [update]
  );

  /** Stamp the omnichannel-order custom type (fulfillmentType, pickupStoreKey, …). */
  const setOmnichannel = useCallback(
    (order: Pick<Order, 'id' | 'version'>, fields: Record<string, unknown>) =>
      update(order, [
        {
          action: 'setCustomType',
          type: { typeId: 'type', key: 'omnichannel-order' },
          fields,
        },
      ]),
    [update]
  );

  return { update, addReturn, setOmnichannel };
};
