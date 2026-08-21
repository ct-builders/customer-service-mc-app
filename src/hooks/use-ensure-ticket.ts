/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import { fullName } from '../utils';
import { useCurrentUser } from '../sdk/use-current-user';
import { useSession } from '../session/session-context';
import {
  useTicketActions,
  type TTicketNote,
  type TTicketValue,
} from './use-tickets';

/**
 * Auto-ticketing. Any CSR write action (place order, issue a refund, change a
 * wish list, file a return, change order state, …) should call `ensureTicket()`
 * so the interaction is always captured under an open ticket: if none is
 * current it opens one for the current customer/business; an optional activity
 * string is appended to the ticket's timeline. Best-effort — callers fire it
 * without blocking the action.
 */
export const useEnsureTicket = () => {
  const { currentCustomer, currentBusiness, currentTicket, setCurrentTicket } =
    useSession();
  const { save, allocateTicketNumber } = useTicketActions();
  const user = useCurrentUser();

  const ensureTicket = useCallback(
    async (activity?: string) => {
      // Nothing to attach a ticket to (no current customer/business).
      if (!currentCustomer && !currentBusiness) return currentTicket;

      const now = () => new Date().toISOString();
      const note = (body: string): TTicketNote => ({
        author: user.email,
        body,
        createdAt: now(),
      });

      if (!currentTicket) {
        const key = `ticket-${Date.now()}`;
        const ticketNumber = await allocateTicketNumber();
        const value: TTicketValue = {
          ticketNumber,
          subject:
            currentBusiness && !currentCustomer
              ? `Ticket — ${currentBusiness.name}`
              : `Ticket — ${fullName(currentCustomer ?? {})}`,
          status: 'open',
          priority: 'medium',
          assignee: user.email,
          customerId: currentCustomer?.id,
          customerEmail: currentCustomer?.email,
          businessUnitId: currentBusiness?.id,
          businessUnitKey: currentBusiness?.key,
          businessUnitName: currentBusiness?.name,
          notes: activity ? [note(activity)] : [],
          createdAt: now(),
        };
        const created = await save(key, value);
        setCurrentTicket(created);
        return created;
      }

      // A ticket is already open — just log the activity to its timeline.
      if (activity) {
        const updated = await save(currentTicket.key, {
          ...currentTicket.value,
          notes: [...(currentTicket.value.notes ?? []), note(activity)],
        });
        setCurrentTicket(updated);
        return updated;
      }
      return currentTicket;
    },
    [
      currentCustomer,
      currentBusiness,
      currentTicket,
      save,
      allocateTicketNumber,
      setCurrentTicket,
      user.email,
    ]
  );

  return { ensureTicket };
};
