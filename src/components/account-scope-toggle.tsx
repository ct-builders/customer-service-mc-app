/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useHistory, useLocation } from 'react-router-dom';
import { useAppBase } from '../sdk/use-app-base';

/**
 * Segmented toggle at the top of the Customer domain: Individuals (customers) vs
 * Businesses (business units). Businesses live under the Customer tab, so this
 * is how a CSR switches between the two account types.
 */
const AccountScopeToggle = () => {
  const { push } = useHistory();
  const { pathname } = useLocation();
  const appBase = useAppBase();
  const rel = pathname.startsWith(appBase)
    ? pathname.slice(appBase.length)
    : pathname;
  const onBusinesses = rel.startsWith('/businesses');
  const opts = [
    { label: 'Individuals', to: `${appBase}/customers`, active: !onBusinesses },
    { label: 'Businesses', to: `${appBase}/businesses`, active: onBusinesses },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #d4d4d8',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {opts.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => push(o.to)}
          style={{
            padding: '6px 14px',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: o.active ? '#3c41c9' : '#fff',
            color: o.active ? '#fff' : '#4b5563',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
AccountScopeToggle.displayName = 'AccountScopeToggle';

export default AccountScopeToggle;
