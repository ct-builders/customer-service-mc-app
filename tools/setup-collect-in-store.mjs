#!/usr/bin/env node
/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/**
 * Idempotently create a free "Collect in Store" shipping method (key
 * `collect-in-store`) used by the assisted-order BOPIS flow. Pickup line items
 * are assigned this method so in-store pickup is $0.
 *
 * Reads CTP_* credentials from the environment (e.g. the project .env).
 * Run:  node tools/setup-collect-in-store.mjs
 */
const {
  CTP_PROJECT_KEY: pk,
  CTP_CLIENT_ID: id,
  CTP_CLIENT_SECRET: secret,
  CTP_AUTH_URL: authUrl,
  CTP_API_URL: apiUrl,
} = process.env;

if (!pk || !id || !secret || !authUrl || !apiUrl) {
  console.error('Missing CTP_* environment variables.');
  process.exit(1);
}

const token = await fetch(`${authUrl}/oauth/token`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
}).then((r) => r.json());

const headers = {
  Authorization: `Bearer ${token.access_token}`,
  'Content-Type': 'application/json',
};

const existing = await fetch(
  `${apiUrl}/${pk}/shipping-methods/key=collect-in-store`,
  { headers }
).then((r) => r.json());
if (existing.id) {
  console.log('collect-in-store already exists:', existing.id);
  process.exit(0);
}

// Reuse the tax category + zones already used by the standard shipping method.
const standard = await fetch(
  `${apiUrl}/${pk}/shipping-methods/key=standard-shipping-method`,
  { headers }
).then((r) => r.json());
const taxCategory = standard.taxCategory;
const zoneRates = (standard.zoneRates ?? []).map((zr) => ({
  zone: zr.zone,
  shippingRates: (zr.shippingRates ?? []).map((r) => ({
    price: { currencyCode: r.price.currencyCode, centAmount: 0 },
  })),
}));

const res = await fetch(`${apiUrl}/${pk}/shipping-methods`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    key: 'collect-in-store',
    name: 'Collect in Store',
    description: 'Buy online, pick up in store (free)',
    isDefault: false,
    taxCategory,
    zoneRates,
  }),
});
const json = await res.json();
console.log(
  res.ok
    ? `Created collect-in-store: ${json.id}`
    : `Failed (${res.status}): ${JSON.stringify(json).slice(0, 400)}`
);
process.exit(res.ok ? 0 : 1);
