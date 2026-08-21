/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import {
  useHistory,
  useLocation,
  useRouteMatch,
  Route,
  Switch,
} from 'react-router-dom';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import Card from '@commercetools-uikit/card';
import DataTable from '@commercetools-uikit/data-table';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import { useCurrentUser } from '../../sdk/use-current-user';
import { useSession } from '../../session/session-context';
import {
  useTicketActions,
  useTickets,
  type TTicket,
  type TTicketPriority,
} from '../../hooks/use-tickets';
import { formatDateTime, getErrorMessage } from '../../utils';
import StatusStamp from '../status-stamp';
import TicketDetail from './ticket-detail';

const columns = [
  { key: 'number', label: 'Ticket #' },
  { key: 'subject', label: 'Subject' },
  { key: 'customer', label: 'Customer / business' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated' },
];

const PRIORITIES: TTicketPriority[] = ['low', 'medium', 'high'];

const Tickets = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  const params = new URLSearchParams(useLocation().search);
  const user = useCurrentUser();
  const { setCurrentTicket, currentCustomer } = useSession();
  const { tickets, loading, error, refetch } = useTickets();
  const { save, allocateTicketNumber } = useTicketActions();

  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [customerEmail, setCustomerEmail] = useState(
    currentCustomer?.email ?? ''
  );
  const [priority, setPriority] = useState<TTicketPriority>('medium');
  const [notice, setNotice] = useState<string>();

  // Filters (also driven by dashboard deep-links: ?mine=1&status=open&priority=high)
  const mineOnly = params.get('mine') === '1';
  const statusFilter = params.get('status') ?? '';
  const priorityFilter = params.get('priority') ?? '';
  const rows = tickets.filter((t) => {
    if (mineOnly && t.value?.assignee !== user.email) return false;
    if (statusFilter && t.value?.status !== statusFilter) return false;
    if (priorityFilter && t.value?.priority !== priorityFilter) return false;
    return true;
  });
  const activeFilters = [
    mineOnly && 'mine',
    statusFilter && `status: ${statusFilter}`,
    priorityFilter && `priority: ${priorityFilter}`,
  ].filter(Boolean);

  const createTicket = async () => {
    if (!subject.trim()) return;
    const key = `ticket-${Date.now()}`;
    try {
      const ticketNumber = await allocateTicketNumber();
      const created = await save(key, {
        ticketNumber,
        subject: subject.trim(),
        status: 'open',
        priority,
        assignee: user.email,
        customerId: currentCustomer?.id,
        customerEmail: customerEmail.trim() || undefined,
        notes: [],
        createdAt: new Date().toISOString(),
      });
      setCreating(false);
      setSubject('');
      setNotice(`Ticket #${ticketNumber} created.`);
      setCurrentTicket(created);
      refetch();
      push(`${match.url}/${key}`);
    } catch (e) {
      setNotice(getErrorMessage(e));
    }
  };

  const openTicket = (ticket: TTicket) => {
    setCurrentTicket(ticket);
    push(`${match.url}/${ticket.key}`);
  };

  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:key`}>
        <TicketDetail onClose={() => push(match.url)} onChanged={refetch} />
      </SuspendedRoute>
      <Route>
        <Spacings.Stack scale="l">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text.Headline as="h2">Tickets</Text.Headline>
            <SecondaryButton
              label="New ticket"
              onClick={() => setCreating((v) => !v)}
            />
          </Spacings.Inline>

          {activeFilters.length > 0 && (
            <Spacings.Inline scale="s" alignItems="center">
              <Text.Detail tone="secondary">
                Filtered by {activeFilters.join(', ')}
              </Text.Detail>
              <SecondaryButton
                label="Clear filters"
                onClick={() => push(match.url)}
              />
            </Spacings.Inline>
          )}

          {creating && (
            <Card theme="light" type="raised">
              <Spacings.Stack scale="s">
                <TextInput
                  value={subject}
                  placeholder="Subject"
                  onChange={(e) => setSubject(e.target.value)}
                />
                <TextInput
                  value={customerEmail}
                  placeholder="Customer email (optional)"
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
                <div style={{ maxWidth: 200 }}>
                  <SelectInput
                    value={priority}
                    options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                    onChange={(e) =>
                      setPriority(e.target.value as TTicketPriority)
                    }
                  />
                </div>
                <PrimaryButton
                  label="Create ticket"
                  isDisabled={!subject.trim()}
                  onClick={createTicket}
                />
              </Spacings.Stack>
            </Card>
          )}

          {notice && (
            <ContentNotification type="info">
              <Text.Body>{notice}</Text.Body>
            </ContentNotification>
          )}
          {!!error && (
            <ContentNotification type="error">
              <Text.Body>{getErrorMessage(error)}</Text.Body>
            </ContentNotification>
          )}
          {loading && <LoadingSpinner />}

          {!loading && rows.length === 0 && (
            <ContentNotification type="info">
              <Text.Body>No tickets match.</Text.Body>
            </ContentNotification>
          )}

          {rows.length > 0 && (
            <DataTable<TTicket>
              columns={columns}
              rows={rows}
              onRowClick={(row) => openTicket(row)}
              itemRenderer={(item, column) => {
                switch (column.key) {
                  case 'number':
                    return item.value?.ticketNumber
                      ? `#${item.value.ticketNumber}`
                      : '—';
                  case 'subject':
                    return item.value?.subject ?? item.key;
                  case 'customer':
                    return item.value?.businessUnitName
                      ? `🏢 ${item.value.businessUnitName}`
                      : item.value?.customerEmail ?? '—';
                  case 'assignee':
                    return item.value?.assignee ?? '—';
                  case 'priority':
                    return <StatusStamp value={item.value?.priority} />;
                  case 'status':
                    return <StatusStamp value={item.value?.status} />;
                  case 'updated':
                    return formatDateTime(item.lastModifiedAt);
                  default:
                    return null;
                }
              }}
            />
          )}
        </Spacings.Stack>
      </Route>
    </Switch>
  );
};
Tickets.displayName = 'Tickets';

export default Tickets;
