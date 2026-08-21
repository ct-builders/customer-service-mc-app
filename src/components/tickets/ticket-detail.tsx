/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Card from '@commercetools-uikit/card';
import FlatButton from '@commercetools-uikit/flat-button';
import Grid from '@commercetools-uikit/grid';
import { BackIcon } from '@commercetools-uikit/icons';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import { useCurrentUser } from '../../sdk/use-current-user';
import { useSession } from '../../session/session-context';
import {
  useTicket,
  useTicketActions,
  type TTicketStatus,
  type TTicketValue,
} from '../../hooks/use-tickets';
import { formatDateTime, getErrorMessage } from '../../utils';
import StatusStamp from '../status-stamp';

const STATUSES: TTicketStatus[] = ['open', 'pending', 'resolved'];

type Props = { onClose: () => void; onChanged: () => void };

const TicketDetail = ({ onClose, onChanged }: Props) => {
  const { key } = useParams<{ key: string }>();
  const { ticket, loading, error, refetch } = useTicket(key);
  const { save } = useTicketActions();
  const { setCurrentTicket } = useSession();
  const user = useCurrentUser();
  const [noteBody, setNoteBody] = useState('');
  const [notice, setNotice] = useState<string>();

  // Reflect the opened ticket in the global status bar.
  useEffect(() => {
    if (ticket) setCurrentTicket(ticket);
  }, [ticket, setCurrentTicket]);

  const persist = async (next: TTicketValue) => {
    try {
      const updated = await save(key, next);
      refetch();
      setCurrentTicket(updated);
      onChanged();
    } catch (e) {
      setNotice(getErrorMessage(e));
    }
  };

  const addNote = () => {
    if (!ticket || !noteBody.trim()) return;
    persist({
      ...ticket.value,
      notes: [
        {
          author: user.email,
          body: noteBody.trim(),
          createdAt: new Date().toISOString(),
        },
        ...ticket.value.notes,
      ],
    });
    setNoteBody('');
  };

  const changeStatus = (status: TTicketStatus) => {
    if (!ticket) return;
    persist({ ...ticket.value, status });
  };

  return (
    <Spacings.Stack scale="l">
      <FlatButton
        label="Back to tickets"
        icon={<BackIcon />}
        onClick={onClose}
      />

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {notice && (
        <ContentNotification type="error">
          <Text.Body>{notice}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}

      {ticket && (
        <Spacings.Stack scale="l">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text.Headline as="h2">
              {ticket.value.ticketNumber
                ? `#${ticket.value.ticketNumber} · `
                : ''}
              {ticket.value.subject}
            </Text.Headline>
            <Spacings.Inline scale="s" alignItems="center">
              <StatusStamp value={ticket.value.priority} />
              <StatusStamp value={ticket.value.status} />
            </Spacings.Inline>
          </Spacings.Inline>

          <Card theme="light" type="raised">
            <Grid
              gridGap="16px"
              gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
            >
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">
                  {ticket.value.businessUnitName ? 'Business' : 'Customer'}
                </Text.Detail>
                <Text.Body>
                  {ticket.value.businessUnitName
                    ? `🏢 ${ticket.value.businessUnitName}`
                    : ticket.value.customerEmail ?? '—'}
                </Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Assignee</Text.Detail>
                <Text.Body>{ticket.value.assignee ?? '—'}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Order</Text.Detail>
                <Text.Body>{ticket.value.orderNumber ?? '—'}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Opened</Text.Detail>
                <Text.Body>{formatDateTime(ticket.value.createdAt)}</Text.Body>
              </Spacings.Stack>
              <Spacings.Stack scale="xs">
                <Text.Detail tone="secondary">Change status</Text.Detail>
                <SelectInput
                  value={ticket.value.status}
                  options={STATUSES.map((s) => ({ value: s, label: s }))}
                  onChange={(e) =>
                    changeStatus(e.target.value as TTicketStatus)
                  }
                />
              </Spacings.Stack>
            </Grid>
          </Card>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Text.Subheadline as="h4">Activity</Text.Subheadline>
              <Spacings.Inline scale="s" alignItems="center">
                <TextInput
                  value={noteBody}
                  placeholder="Add a note to the timeline"
                  onChange={(e) => setNoteBody(e.target.value)}
                />
                <PrimaryButton
                  label="Add note"
                  isDisabled={!noteBody.trim()}
                  onClick={addNote}
                />
              </Spacings.Inline>
              {ticket.value.notes.length === 0 && (
                <Text.Detail tone="secondary">No activity yet.</Text.Detail>
              )}
              {ticket.value.notes.map((n, i) => (
                <Spacings.Stack key={i} scale="xs">
                  <Text.Detail tone="secondary">
                    {n.author} · {formatDateTime(n.createdAt)}
                  </Text.Detail>
                  <Text.Body>{n.body}</Text.Body>
                </Spacings.Stack>
              ))}
            </Spacings.Stack>
          </Card>
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
TicketDetail.displayName = 'TicketDetail';

export default TicketDetail;
