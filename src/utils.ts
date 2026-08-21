/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  Address,
  LocalizedString,
  TypedMoney,
} from '@commercetools/platform-sdk';

/** Format a commercetools typed money value as a localized currency string. */
export const formatMoney = (money?: TypedMoney): string => {
  if (!money) return '—';
  const amount = money.centAmount / 10 ** (money.fractionDigits ?? 2);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currencyCode,
    }).format(amount);
  } catch {
    return `${amount.toFixed(money.fractionDigits ?? 2)} ${money.currencyCode}`;
  }
};

export const formatDateTime = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const formatDate = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
};

/** Pick the first available value from a LocalizedString. */
export const localized = (
  value?: LocalizedString,
  locale = 'en-US'
): string => {
  if (!value) return '';
  return value[locale] ?? Object.values(value)[0] ?? '';
};

export const fullName = (parts: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string => {
  const name = [parts.firstName, parts.lastName].filter(Boolean).join(' ');
  return name || parts.email || '—';
};

export const formatAddress = (address?: Address): string => {
  if (!address) return '—';
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.streetName &&
      [address.streetNumber, address.streetName].filter(Boolean).join(' '),
    [address.postalCode, address.city].filter(Boolean).join(' '),
    [address.state, address.country].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');
};

/** Turn an unknown thrown value (Apollo / SDK / Error) into a display string. */
export const getErrorMessage = (error: unknown): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) {
    return error.map((e) => getErrorMessage(e)).join('\n');
  }
  if (typeof error === 'object') {
    const e = error as {
      message?: string;
      body?: { message?: string; errors?: Array<{ message?: string }> };
    };
    if (e.body?.errors?.length) {
      return e.body.errors
        .map((x) => x.message)
        .filter(Boolean)
        .join('\n');
    }
    return e.body?.message ?? e.message ?? JSON.stringify(error);
  }
  return String(error);
};
