/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  CustomLineItem,
  LineItem,
  Order,
} from '@commercetools/platform-sdk';
import { orderLines } from './order-lines';

/**
 * The regression these exist for: the order screens rendered `order.lineItems`
 * only, so an order whose money lives in CustomLineItems — every order in a
 * project whose catalog is not in commercetools — showed an EMPTY items table,
 * a subtotal of 0 and an empty return-filing list. Nothing errored; it just
 * silently had no content.
 */

const money = (centAmount: number, fractionDigits = 2) => ({
  type: 'centPrecision' as const,
  currencyCode: 'USD',
  centAmount,
  fractionDigits,
});

const customLine = (over: Partial<CustomLineItem> = {}): CustomLineItem =>
  ({
    id: 'cli-1',
    name: { 'en-US': 'Embroidered Overalls' },
    slug: 'KIC-155-M',
    quantity: 2,
    money: money(15000),
    totalPrice: money(30000),
    discountedPricePerQuantity: [],
    taxedPricePortions: [],
    state: [],
    perMethodTaxRate: [],
    priceMode: 'Standard',
    taxRate: {
      name: 'Chicago, IL sales tax',
      amount: 0.1025,
      includedInPrice: false,
      country: 'US',
      state: 'IL',
      subRates: [],
    },
    taxedPrice: {
      totalNet: money(30000),
      totalGross: money(33075),
      totalTax: money(3075),
    },
    custom: {
      type: { typeId: 'type', id: 'type-1' },
      fields: { partNumber: 'KIC-155', size: 'M', taxCode: 'AP-CLOTHING' },
    },
    ...over,
  } as CustomLineItem);

const line = (over: Partial<LineItem> = {}): LineItem =>
  ({
    id: 'li-1',
    productId: 'p-1',
    name: { 'en-US': 'A commercetools product' },
    quantity: 1,
    variant: { id: 1, sku: 'SKU-1' },
    price: { id: 'pr-1', value: money(999) },
    totalPrice: money(999),
    discountedPricePerQuantity: [],
    taxedPricePortions: [],
    state: [],
    perMethodTaxRate: [],
    priceMode: 'Platform',
    lineItemMode: 'Standard',
    ...over,
  } as unknown as LineItem);

const order = (over: Partial<Order>): Order =>
  ({
    id: 'o-1',
    version: 1,
    lineItems: [],
    customLineItems: [],
    totalPrice: money(0),
    ...over,
  } as unknown as Order);

describe('orderLines', () => {
  it('returns custom line items — the regression this module exists for', () => {
    const lines = orderLines(order({ customLineItems: [customLine()] }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'customLineItem',
      // The clean catalog sku, NOT the slug: the slug carries the size suffix
      // that makes each variant unique inside one order.
      sku: 'KIC-155',
      name: 'Embroidered Overalls',
      variant: 'M',
      quantity: 2,
      unitCentAmount: 15000,
      totalCentAmount: 30000,
      taxRateName: 'Chicago, IL sales tax',
      taxCentAmount: 3075,
      slug: 'KIC-155-M',
      taxCode: 'AP-CLOTHING',
    });
  });

  it('falls back to the slug when no sku field was recorded', () => {
    const lines = orderLines(
      order({ customLineItems: [customLine({ custom: undefined })] })
    );
    expect(lines[0].sku).toBe('KIC-155-M');
    expect(lines[0].variant).toBeNull();
  });

  it('reads custom fields a project names differently', () => {
    const lines = orderLines(
      order({
        customLineItems: [
          customLine({
            custom: {
              type: { typeId: 'type', id: 'type-1' },
              fields: { articleNumber: 'ART-9', variantSize: 'L' },
            },
          }),
        ],
      }),
      { fields: { sku: 'articleNumber', size: 'variantSize' } }
    );
    expect(lines[0]).toMatchObject({ sku: 'ART-9', variant: 'L' });
  });

  it('still returns plain line items, so other projects are unaffected', () => {
    const lines = orderLines(order({ lineItems: [line()] }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'lineItem',
      sku: 'SKU-1',
      name: 'A commercetools product',
      // Nothing is derived from a LineItem's attributes: its sku already
      // identifies it, and inventing a label would change what a
      // commercetools-catalog project already sees.
      variant: null,
      unitCentAmount: 999,
      totalCentAmount: 999,
    });
  });

  it('returns both kinds together, line items first', () => {
    const lines = orderLines(
      order({ lineItems: [line()], customLineItems: [customLine()] })
    );
    expect(lines.map((l) => l.kind)).toEqual(['lineItem', 'customLineItem']);
  });

  it('totals computed from it match the order — the empty-totals bug', () => {
    const lines = orderLines(order({ customLineItems: [customLine()] }));
    expect(lines.reduce((sum, l) => sum + l.totalCentAmount, 0)).toBe(30000);
  });

  it('renders a size AND colour when both are recorded', () => {
    const lines = orderLines(
      order({
        customLineItems: [
          customLine({
            custom: {
              type: { typeId: 'type', id: 'type-1' },
              fields: { partNumber: 'X', size: 'M', color: 'Cream' },
            },
          }),
        ],
      })
    );
    expect(lines[0].variant).toBe('M · Cream');
  });

  it('carries the currency and fraction digits of a non-decimal currency', () => {
    const yen = { ...money(1500, 0), currencyCode: 'JPY' };
    const lines = orderLines(
      order({
        customLineItems: [customLine({ money: yen, totalPrice: yen })],
      })
    );
    expect(lines[0]).toMatchObject({
      currencyCode: 'JPY',
      fractionDigits: 0,
    });
  });

  it('survives an order with neither kind of line', () => {
    expect(orderLines(order({}))).toEqual([]);
  });
});
