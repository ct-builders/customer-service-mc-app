/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  Cart,
  CartDraft,
  CartUpdateAction,
  DirectDiscountDraft,
  Order,
} from '@commercetools/platform-sdk';
import { useCtp } from '../sdk/use-ctp';

/** Build an absolute-money direct discount targeting line items or shipping. */
export const absoluteDirectDiscount = (
  centAmount: number,
  currencyCode: string,
  target: 'lineItems' | 'shipping'
): DirectDiscountDraft => ({
  value: {
    type: 'absolute',
    money: [{ currencyCode, centAmount }],
  },
  target:
    target === 'shipping'
      ? { type: 'shipping' }
      : { type: 'lineItems', predicate: '1 = 1' },
});

/** Cart + order operations used by the CSR-assisted order flow. */
export const useCartActions = () => {
  const { get, post } = useCtp();

  const createCart = useCallback(
    (draft: CartDraft) => post<Cart>(`/carts`, draft),
    [post]
  );

  const getCart = useCallback(
    (cartId: string) => get<Cart>(`/carts/${cartId}`),
    [get]
  );

  const updateCart = useCallback(
    (cart: Pick<Cart, 'id' | 'version'>, actions: CartUpdateAction[]) =>
      post<Cart>(`/carts/${cart.id}`, { version: cart.version, actions }),
    [post]
  );

  const placeOrder = useCallback(
    (cart: Pick<Cart, 'id' | 'version'>) =>
      post<Order>(`/orders`, {
        cart: { id: cart.id, typeId: 'cart' },
        version: cart.version,
      }),
    [post]
  );

  const addDiscountCode = useCallback(
    (cart: Pick<Cart, 'id' | 'version'>, code: string) =>
      post<Cart>(`/carts/${cart.id}`, {
        version: cart.version,
        actions: [{ action: 'addDiscountCode', code }],
      }),
    [post]
  );

  /** CSR price/shipping override: replaces the cart's direct discounts. */
  const setDirectDiscounts = useCallback(
    (cart: Pick<Cart, 'id' | 'version'>, discounts: DirectDiscountDraft[]) =>
      post<Cart>(`/carts/${cart.id}`, {
        version: cart.version,
        actions: [{ action: 'setDirectDiscounts', discounts }],
      }),
    [post]
  );

  return {
    createCart,
    getCart,
    updateCart,
    placeOrder,
    addDiscountCode,
    setDirectDiscounts,
  };
};
