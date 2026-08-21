/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  CustomObject,
  CustomObjectPagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';

/**
 * commercetools has no native ticket entity, so CSR tickets are modeled as
 * Custom Objects. ("Ticket" is the term used across support tooling; this covers
 * Oracle ATG's "call tracking" concept.)
 */
export const TICKETS_CONTAINER = 'csr-tickets';

/** Sequential human-facing ticket numbers live in a single counter Custom Object. */
export const COUNTERS_CONTAINER = 'csr-counters';
const TICKET_SEQ_KEY = 'ticket-seq';
const FIRST_TICKET_NUMBER = 1000;

export type TTicketStatus = 'open' | 'pending' | 'resolved';
export type TTicketPriority = 'low' | 'medium' | 'high';

export type TTicketNote = {
  author: string;
  body: string;
  createdAt: string;
};

export type TTicketValue = {
  /** Sequential human-facing number, e.g. 1000. Allocated at creation. */
  ticketNumber?: number;
  subject: string;
  status: TTicketStatus;
  priority: TTicketPriority;
  assignee?: string;
  customerId?: string;
  customerEmail?: string;
  /** Set when the ticket is on behalf of a B2B business unit (vs an individual). */
  businessUnitId?: string;
  businessUnitKey?: string;
  businessUnitName?: string;
  orderId?: string;
  orderNumber?: string;
  notes: TTicketNote[];
  createdAt: string;
};

export type TTicket = Omit<CustomObject, 'value'> & { value: TTicketValue };

export const useTickets = () => {
  const { get } = useCtp();
  const { data, loading, error, refetch } =
    useAsyncData<CustomObjectPagedQueryResponse>(
      () =>
        get(
          `/custom-objects/${TICKETS_CONTAINER}?limit=200&sort=lastModifiedAt desc`
        ),
      []
    );
  return {
    tickets: (data?.results ?? []) as TTicket[],
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  };
};

export const useTicket = (key: string) => {
  const { get } = useCtp();
  const { data, loading, error, refetch } = useAsyncData<CustomObject>(
    () => get(`/custom-objects/${TICKETS_CONTAINER}/${key}`),
    [key],
    Boolean(key)
  );
  return { ticket: data as TTicket | undefined, loading, error, refetch };
};

export const useTicketActions = () => {
  const { get, post } = useCtp();

  /** Custom objects upsert by (container, key); POST creates or updates. */
  const save = useCallback(
    (key: string, value: TTicketValue) =>
      post<TTicket>(`/custom-objects`, {
        container: TICKETS_CONTAINER,
        key,
        value,
      }),
    [post]
  );

  /**
   * Allocate the next sequential ticket number (1000, 1001, …), race-safe.
   * Reads the counter Custom Object with its version, then writes the increment
   * back *with that version* — commercetools rejects a stale version with a 409
   * (ConcurrentModification), so two CSRs creating tickets at once never get the
   * same number; on conflict we re-read and retry.
   */
  const allocateTicketNumber = useCallback(async (): Promise<number> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let next = FIRST_TICKET_NUMBER;
      let version: number | undefined;
      try {
        const counter = await get<CustomObject>(
          `/custom-objects/${COUNTERS_CONTAINER}/${TICKET_SEQ_KEY}`
        );
        next =
          (counter.value as { next?: number } | undefined)?.next ??
          FIRST_TICKET_NUMBER;
        version = counter.version;
      } catch {
        // 404 — counter not created yet; this call allocates the first number.
      }
      try {
        await post(`/custom-objects`, {
          container: COUNTERS_CONTAINER,
          key: TICKET_SEQ_KEY,
          value: { next: next + 1 },
          ...(version !== undefined ? { version } : {}),
        });
        return next;
      } catch (e) {
        const status =
          (e as { statusCode?: number; status?: number }).statusCode ??
          (e as { status?: number }).status;
        if (status === 409) continue; // concurrent allocation — re-read and retry
        throw e;
      }
    }
    throw new Error(
      'Could not allocate a ticket number (too much contention). Please retry.'
    );
  }, [get, post]);

  return { save, allocateTicketNumber };
};

export type TStoreCredit = Omit<CustomObject, 'value'> & {
  value: { currencyCode: string; amount: number };
};

export const STORE_CREDIT_CONTAINER = 'csr-store-credit';

/** Store-credit balance for a customer (Custom Object keyed by customer id). */
export const useStoreCredit = (customerId?: string) => {
  const { get } = useCtp();
  const { data, loading } = useAsyncData<CustomObject | undefined>(
    () =>
      get<CustomObject>(
        `/custom-objects/${STORE_CREDIT_CONTAINER}/${customerId}`
      ).catch(() => undefined),
    [customerId],
    Boolean(customerId)
  );
  return { credit: data as TStoreCredit | undefined, loading };
};
