/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAppBase } from '../sdk/use-app-base';
import { useSession } from '../session/session-context';

/**
 * The single top navigation for the app — one row of tab-like buttons, always
 * visible. Organized by domain (Customer / Orders / Cart / Tickets); Businesses
 * live under the Customer domain (toggle on the Customers list). Each tab's
 * label is singular or plural depending on context, has a number keyboard
 * shortcut (1–4, shown on hover), and lands on the singular view when a single
 * item is in context, otherwise the list/search.
 */
const DomainTabs = () => {
  const { push } = useHistory();
  const { pathname } = useLocation();
  const appBase = useAppBase();
  const { currentCustomer, currentBusiness, currentTicket } = useSession();

  const rel = pathname.startsWith(appBase)
    ? pathname.slice(appBase.length)
    : pathname;
  const inCustomerDomain =
    rel.startsWith('/customers') || rel.startsWith('/businesses');

  const tabs = [
    {
      key: 'customer',
      label: currentCustomer
        ? 'Customer'
        : currentBusiness
        ? 'Business'
        : 'Customers',
      to: currentCustomer
        ? `${appBase}/customers/${currentCustomer.id}`
        : currentBusiness
        ? `${appBase}/businesses/${currentBusiness.id}`
        : `${appBase}/customers`,
      active: inCustomerDomain,
    },
    {
      key: 'order',
      label: /^\/orders\/.+/.test(rel) ? 'Order' : 'Orders',
      to: `${appBase}/orders`,
      active: rel.startsWith('/orders'),
    },
    {
      key: 'cart',
      label: 'Cart',
      to: `${appBase}/cart`,
      active: rel.startsWith('/cart') || rel.startsWith('/assisted-order'),
    },
    {
      key: 'ticket',
      label: currentTicket ? 'Ticket' : 'Tickets',
      to: currentTicket
        ? `${appBase}/tickets/${currentTicket.key}`
        : `${appBase}/tickets`,
      active: rel.startsWith('/tickets'),
    },
  ];

  // Number-key shortcuts (1–4) switch tabs when not typing in a field.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
      )
        return;
      const idx = Number(e.key) - 1;
      const tab = tabsRef.current[idx];
      if (tab) {
        e.preventDefault();
        push(tab.to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [push]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        // MC's content area is a flex column that stretches children (flex:1);
        // pin the tab bar so it doesn't grow tall on short pages.
        flex: '0 0 auto',
        gap: 2,
        borderBottom: '1px solid #e3e3e3',
        padding: '0 16px',
        background: '#fff',
      }}
    >
      <style>{`.csr-tab{display:inline-flex;align-items:center;gap:7px;background:none;border:none;padding:9px 16px;font:inherit;font-weight:600;font-size:14px;color:#4b5563;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px;}.csr-tab:hover{color:#1f2937;}.csr-tab:focus,.csr-tab:focus-visible{outline:none;}.csr-tab[data-active="true"]{color:#3c41c9;border-bottom-color:#3c41c9;}.csr-kbd{font-size:11px;line-height:1;font-weight:600;padding:2px 5px;border:1px solid #d4d4d8;border-bottom-width:2px;border-radius:4px;color:#6b7280;background:#f4f4f5;}.csr-tab[data-active="true"] .csr-kbd{color:#3c41c9;border-color:#c7c9f0;background:#eef0ff;}`}</style>
      {tabs.map((t, i) => (
        <button
          key={t.key}
          type="button"
          className="csr-tab"
          data-active={t.active}
          title={`${t.label} — press ${i + 1}`}
          onClick={() => push(t.to)}
        >
          {t.label}
          <kbd className="csr-kbd" aria-hidden="true">
            {i + 1}
          </kbd>
        </button>
      ))}
      {/* Settings is not a domain, so it sits after a spacer instead of becoming
          tab 5 — that keeps the 1–4 keyboard shortcuts stable. */}
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="csr-tab"
        data-active={rel.startsWith('/settings')}
        title="Settings — storefront wiring for “shop as customer”"
        onClick={() => push(`${appBase}/settings`)}
      >
        Settings
      </button>
    </div>
  );
};
DomainTabs.displayName = 'DomainTabs';

export default DomainTabs;
