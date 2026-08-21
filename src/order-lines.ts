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
import { localized } from './utils';

/**
 * One shape for both kinds of order line.
 *
 * An Order's money can live in `lineItems`, in `customLineItems`, or in both.
 * Reading `order.lineItems` alone is correct only for a project whose catalog is
 * in commercetools; a project that keeps its catalog elsewhere (an external
 * catalog, a PIM, a marketplace feed) has no Product to reference, so only a
 * sku, a name and a price travel with the add-to-bag and every line arrives as a
 * **CustomLineItem**. Such an order rendered an *empty* items table, a subtotal
 * of 0 and an empty return-filing list — silently, with no error.
 *
 * Rather than branch in the order screens, everything normalises through
 * `orderLines`, so an order with LineItems, an order with CustomLineItems, and a
 * mixed order all render the same way.
 */

/**
 * Where each `OrderLine` field is read from on a CustomLineItem's custom type.
 *
 * A CustomLineItem carries no ProductVariant, so the details a CSR needs to
 * identify a line — its catalog sku, its size and colour, its tax code, an
 * image — can only come from custom fields. The defaults below are the common
 * convention rather than a requirement: pass `fields` to `orderLines` for a
 * project that names them differently. Nothing breaks when a field is absent —
 * `sku` falls back to the CustomLineItem's slug and the rest go null.
 */
export type CustomLineItemFieldNames = {
  sku: string;
  size: string;
  color: string;
  taxCode: string;
  imageUrl: string;
};

export const CUSTOM_LINE_ITEM_FIELDS: CustomLineItemFieldNames = {
  sku: 'partNumber',
  size: 'size',
  color: 'color',
  taxCode: 'taxCode',
  imageUrl: 'imageUrl',
};

export type OrderLineKind = 'lineItem' | 'customLineItem';

export interface OrderLine {
  id: string;
  kind: OrderLineKind;
  /** The variant's sku, or a CustomLineItem's sku custom field / slug. */
  sku: string | null;
  name: string;
  /** Size/colour where the source records them, so a CSR can tell lines apart. */
  variant: string | null;
  quantity: number;
  unitCentAmount: number;
  totalCentAmount: number;
  currencyCode: string;
  /** Carried so a non-2-decimal currency still formats correctly. */
  fractionDigits: number;
  taxRateName: string | null;
  taxRateAmount: number | null;
  taxCentAmount: number | null;
  /** CustomLineItem only — the slug is its natural key within an order. */
  slug: string | null;
  taxCode: string | null;
  imageUrl: string | null;
}

export type OrderLinesOptions = {
  locale?: string;
  fields?: Partial<CustomLineItemFieldNames>;
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const fromLineItem = (item: LineItem, locale: string): OrderLine => ({
  id: item.id,
  kind: 'lineItem',
  sku: item.variant?.sku ?? null,
  name: localized(item.name, locale),
  // A LineItem's variant is a real ProductVariant whose sku already identifies
  // it in the table, so nothing is derived from its attributes here — that would
  // change what a commercetools-catalog project already sees.
  variant: null,
  quantity: item.quantity,
  unitCentAmount: item.price?.value?.centAmount ?? 0,
  totalCentAmount: item.totalPrice.centAmount,
  currencyCode: item.totalPrice.currencyCode,
  fractionDigits: item.totalPrice.fractionDigits,
  taxRateName: item.taxRate?.name ?? null,
  taxRateAmount: item.taxRate?.amount ?? null,
  taxCentAmount: item.taxedPrice?.totalTax?.centAmount ?? null,
  slug: null,
  taxCode: null,
  imageUrl: item.variant?.images?.[0]?.url ?? null,
});

const fromCustomLineItem = (
  item: CustomLineItem,
  locale: string,
  fields: CustomLineItemFieldNames
): OrderLine => {
  const custom = item.custom?.fields ?? {};
  const size = str(custom[fields.size]);
  const color = str(custom[fields.color]);
  return {
    id: item.id,
    kind: 'customLineItem',
    // The sku field is the clean catalog identifier; the slug tends to carry a
    // variant suffix, because it is what makes each line unique inside one
    // order. Prefer the former, fall back to the latter.
    sku: str(custom[fields.sku]) ?? item.slug,
    name: localized(item.name, locale),
    variant: [size, color].filter(Boolean).join(' · ') || null,
    quantity: item.quantity,
    unitCentAmount: item.money.centAmount,
    totalCentAmount: item.totalPrice.centAmount,
    currencyCode: item.totalPrice.currencyCode,
    fractionDigits: item.totalPrice.fractionDigits,
    taxRateName: item.taxRate?.name ?? null,
    taxRateAmount: item.taxRate?.amount ?? null,
    taxCentAmount: item.taxedPrice?.totalTax?.centAmount ?? null,
    slug: item.slug,
    taxCode: str(custom[fields.taxCode]),
    imageUrl: str(custom[fields.imageUrl]),
  };
};

/** Every line on an order, LineItems first, in one shape. */
export const orderLines = (
  order: Order,
  options: OrderLinesOptions = {}
): OrderLine[] => {
  const locale = options.locale ?? 'en-US';
  const fields = { ...CUSTOM_LINE_ITEM_FIELDS, ...options.fields };
  return [
    ...(order.lineItems ?? []).map((item) => fromLineItem(item, locale)),
    ...(order.customLineItems ?? []).map((item) =>
      fromCustomLineItem(item, locale, fields)
    ),
  ];
};
