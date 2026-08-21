/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import type { TTicket } from '../hooks/use-tickets';

/** Minimal customer reference kept in the CSR session (full record lives in CT). */
export type TCustomerRef = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/** Minimal business-unit reference kept in the CSR session (B2B accounts). */
export type TBusinessRef = {
  id: string;
  key: string;
  name: string;
};

/**
 * localStorage key for the CSR's working session (current customer / business /
 * ticket). Scoped BY PROJECT KEY on purpose.
 *
 * It used to be a single global 'csr-session-v1'. The same Merchant Center user
 * hops between projects, so the app would restore a customer belonging to a
 * different project entirely — the dashboard showed them as "current", and
 * "Place order for customer" launched the storefront for a customer id that
 * 404s there, landing the CSR on a blank/gated page with no clue why. Keying by
 * project makes each project's working set independent.
 */
const storageKey = (projectKey: string) => `csr-session-v1:${projectKey}`;
const MAX_RECENT = 8;

type PersistedSession = {
  currentCustomer?: TCustomerRef;
  recentCustomers: TCustomerRef[];
  currentBusiness?: TBusinessRef;
  recentBusinesses: TBusinessRef[];
};

type TSession = {
  currentCustomer?: TCustomerRef;
  recentCustomers: TCustomerRef[];
  currentBusiness?: TBusinessRef;
  recentBusinesses: TBusinessRef[];
  currentTicket?: TTicket;
  selectCustomer: (customer: TCustomerRef) => void;
  clearCustomer: () => void;
  selectBusiness: (business: TBusinessRef) => void;
  clearBusiness: () => void;
  setCurrentTicket: (ticket: TTicket | undefined) => void;
};

const readPersisted = (key: string): PersistedSession => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as PersistedSession;
  } catch {
    /* ignore */
  }
  return { recentCustomers: [], recentBusinesses: [] };
};

const SessionContext = createContext<TSession | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const projectKey = useApplicationContext<string>(
    (context) => context.project?.key ?? ''
  );
  const key = storageKey(projectKey);
  const [persisted, setPersisted] = useState<PersistedSession>(() =>
    readPersisted(key)
  );
  const [currentTicket, setTicketState] = useState<TTicket | undefined>(
    undefined
  );

  /**
   * Setting a ticket makes THAT ticket's customer the current customer, so the
   * status bar never shows a ticket for one person next to a different current
   * customer. (Keeps the existing richer ref — with names — if the id matches.)
   */
  const setCurrentTicket = useCallback((ticket: TTicket | undefined) => {
    setTicketState(ticket);
    const v = ticket?.value;
    if (!v) return;
    setPersisted((prev) => {
      let next = prev;
      // Sync the ticket's customer as current (individual tickets).
      if (v.customerId && prev.currentCustomer?.id !== v.customerId) {
        const ref: TCustomerRef = {
          id: v.customerId,
          email: v.customerEmail || '',
        };
        next = {
          ...next,
          currentCustomer: ref,
          recentCustomers: [
            ref,
            ...next.recentCustomers.filter((c) => c.id !== ref.id),
          ].slice(0, MAX_RECENT),
        };
      }
      // Sync the ticket's business as current (business tickets).
      if (v.businessUnitId && prev.currentBusiness?.id !== v.businessUnitId) {
        const ref: TBusinessRef = {
          id: v.businessUnitId,
          key: v.businessUnitKey || '',
          name: v.businessUnitName || '',
        };
        next = {
          ...next,
          currentBusiness: ref,
          recentBusinesses: [
            ref,
            ...(next.recentBusinesses ?? []).filter((b) => b.id !== ref.id),
          ].slice(0, MAX_RECENT),
        };
      }
      return next;
    });
  }, []);

  // Re-read when the project changes (the MC swaps projects without remounting),
  // so the working set follows the project rather than leaking across them.
  useEffect(() => {
    setPersisted(readPersisted(key));
    setTicketState(undefined);
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(persisted));
    } catch {
      /* ignore */
    }
  }, [key, persisted]);

  const selectCustomer = useCallback((customer: TCustomerRef) => {
    setPersisted((prev) => {
      const recentCustomers = [
        customer,
        ...prev.recentCustomers.filter((c) => c.id !== customer.id),
      ].slice(0, MAX_RECENT);
      return { ...prev, currentCustomer: customer, recentCustomers };
    });
  }, []);

  const clearCustomer = useCallback(() => {
    setPersisted((prev) => ({ ...prev, currentCustomer: undefined }));
    setCurrentTicket(undefined);
  }, [setCurrentTicket]);

  const selectBusiness = useCallback((business: TBusinessRef) => {
    setPersisted((prev) => {
      const recentBusinesses = [
        business,
        ...(prev.recentBusinesses ?? []).filter((b) => b.id !== business.id),
      ].slice(0, MAX_RECENT);
      return { ...prev, currentBusiness: business, recentBusinesses };
    });
  }, []);

  const clearBusiness = useCallback(() => {
    setPersisted((prev) => ({ ...prev, currentBusiness: undefined }));
    setCurrentTicket(undefined);
  }, [setCurrentTicket]);

  const value = useMemo<TSession>(
    () => ({
      currentCustomer: persisted.currentCustomer,
      recentCustomers: persisted.recentCustomers,
      currentBusiness: persisted.currentBusiness,
      recentBusinesses: persisted.recentBusinesses ?? [],
      currentTicket,
      selectCustomer,
      clearCustomer,
      selectBusiness,
      clearBusiness,
      setCurrentTicket,
    }),
    [
      persisted,
      currentTicket,
      selectCustomer,
      clearCustomer,
      selectBusiness,
      clearBusiness,
      setCurrentTicket,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = (): TSession => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
};
