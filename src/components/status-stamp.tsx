/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// `React` must be in scope for the <React.Fragment> below. This app builds with
// the classic JSX runtime (@commercetools-frontend/babel-preset-mc-app +
// @emotion/babel-preset-css-prop): ordinary JSX compiles to `___EmotionJSX(...)`
// and needs nothing imported, but a fragment stays a literal `React.Fragment`
// reference. Without this import that is a bare global and the app dies at
// render with `ReferenceError: React is not defined` — tsc does NOT catch it.
import React from 'react';
import Stamp from '@commercetools-uikit/stamp';
import type { TTone } from '@commercetools-uikit/stamp';

const TONES: Record<string, TTone> = {
  // order / payment / shipment states
  Open: 'information',
  Confirmed: 'primary',
  Complete: 'positive',
  Cancelled: 'critical',
  Pending: 'warning',
  Paid: 'positive',
  Failed: 'critical',
  Ready: 'primary',
  Shipped: 'positive',
  Returned: 'warning',
  // case states
  open: 'warning',
  pending: 'information',
  resolved: 'positive',
  // priorities
  low: 'secondary',
  medium: 'information',
  high: 'critical',
};

type Props = { value?: string };

const StatusStamp = ({ value }: Props) => {
  if (!value) return <React.Fragment>—</React.Fragment>;
  return <Stamp isCondensed tone={TONES[value] ?? 'secondary'} label={value} />;
};
StatusStamp.displayName = 'StatusStamp';

export default StatusStamp;
