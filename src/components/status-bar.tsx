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
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { InfoModalPage } from '@commercetools-frontend/application-components';
import Card from '@commercetools-uikit/card';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import { useAppBase } from '../sdk/use-app-base';
import { useCurrentUser } from '../sdk/use-current-user';
import { useSession } from '../session/session-context';
import { useTicketActions, type TTicketValue } from '../hooks/use-tickets';
import { fullName, getErrorMessage } from '../utils';
import CustomerPicker from './customer-picker';
import StatusStamp from './status-stamp';

const StatusBar = () => {
  const {
    currentCustomer,
    currentBusiness,
    currentTicket,
    clearCustomer,
    clearBusiness,
    setCurrentTicket,
  } = useSession();
  const { save, allocateTicketNumber } = useTicketActions();
  const user = useCurrentUser();
  const { push } = useHistory();
  const appBase = useAppBase();

  const [showPicker, setShowPicker] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const patchTicket = async (patch: Partial<TTicketValue>, message: string) => {
    if (!currentTicket) return;
    setBusy(true);
    try {
      const updated = await save(currentTicket.key, {
        ...currentTicket.value,
        ...patch,
      });
      setCurrentTicket(updated);
      setNotice(message);
    } catch (e) {
      setNotice(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const createTicket = async () => {
    setBusy(true);
    try {
      const key = `ticket-${Date.now()}`;
      const ticketNumber = await allocateTicketNumber();
      const value: TTicketValue = {
        ticketNumber,
        subject: `Ticket — ${fullName(currentCustomer ?? {})}`,
        status: 'open',
        priority: 'medium',
        assignee: user.email,
        customerId: currentCustomer?.id,
        customerEmail: currentCustomer?.email,
        notes: [],
        createdAt: new Date().toISOString(),
      };
      const created = await save(key, value);
      setCurrentTicket(created);
      setNotice(`Ticket #${ticketNumber} opened.`);
    } catch (e) {
      setNotice(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, flex: '0 0 auto' }}>
      <Card theme="light" type="raised" insetScale="s">
        <Spacings.Stack scale="xs">
          <Spacings.Inline
            scale="l"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* Current customer */}
            <Spacings.Inline scale="s" alignItems="center">
              <Text.Detail>Customer:</Text.Detail>
              {currentCustomer ? (
                <React.Fragment>
                  <style>{`.csr-customer-link{background:none;border:none;padding:0;font:inherit;font-weight:700;color:#3c41c9;cursor:pointer;}.csr-customer-link:hover{text-decoration:underline;}`}</style>
                  <button
                    type="button"
                    className="csr-customer-link"
                    title="Open customer page"
                    onClick={() =>
                      push(`${appBase}/customers/${currentCustomer.id}`)
                    }
                  >
                    {fullName(currentCustomer)}
                  </button>
                  <Text.Detail tone="secondary">
                    {currentCustomer.email}
                  </Text.Detail>
                  <SecondaryButton
                    size="10"
                    label="Change"
                    onClick={() => setShowPicker(true)}
                  />
                  <SecondaryButton
                    size="10"
                    label="Clear"
                    onClick={() => {
                      clearCustomer();
                      push(`${appBase}/customers`);
                    }}
                  />
                </React.Fragment>
              ) : (
                <SecondaryButton
                  size="10"
                  label="Select customer"
                  onClick={() => setShowPicker(true)}
                />
              )}
              {currentBusiness && (
                <React.Fragment>
                  <Text.Detail tone="secondary">· Business:</Text.Detail>
                  <button
                    type="button"
                    className="csr-customer-link"
                    title="Open business page"
                    onClick={() =>
                      push(`${appBase}/businesses/${currentBusiness.id}`)
                    }
                  >
                    {currentBusiness.name}
                  </button>
                  <SecondaryButton
                    size="10"
                    label="Clear"
                    onClick={clearBusiness}
                  />
                </React.Fragment>
              )}
            </Spacings.Inline>

            {/* Current ticket */}
            <Spacings.Inline scale="s" alignItems="center">
              <Text.Detail>Ticket:</Text.Detail>
              {currentTicket ? (
                <React.Fragment>
                  <Text.Body isBold>
                    {currentTicket.value.ticketNumber
                      ? `#${currentTicket.value.ticketNumber} · `
                      : ''}
                    {currentTicket.value.subject}
                  </Text.Body>
                  <StatusStamp value={currentTicket.value.status} />
                  <SecondaryButton
                    size="10"
                    label="Postpone"
                    isDisabled={busy}
                    onClick={() =>
                      patchTicket({ status: 'pending' }, 'Ticket postponed.')
                    }
                  />
                  <SecondaryButton
                    size="10"
                    label="Transfer"
                    isDisabled={busy}
                    onClick={() => setTransferring((v) => !v)}
                  />
                  <SecondaryButton
                    size="10"
                    label="Close"
                    isDisabled={busy}
                    onClick={() =>
                      patchTicket(
                        { status: 'resolved' },
                        'Ticket closed.'
                      ).then(() => setCurrentTicket(undefined))
                    }
                  />
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Text.Detail tone="secondary">none</Text.Detail>
                  <PrimaryButton
                    size="10"
                    label="New ticket"
                    isDisabled={busy}
                    onClick={createTicket}
                  />
                </React.Fragment>
              )}
            </Spacings.Inline>
          </Spacings.Inline>

          {transferring && currentTicket && (
            <Spacings.Inline scale="s" alignItems="center">
              <TextInput
                value={transferTo}
                placeholder="Assignee email to transfer to"
                onChange={(e) => setTransferTo(e.target.value)}
              />
              <PrimaryButton
                size="10"
                label="Transfer"
                isDisabled={busy || !transferTo.trim()}
                onClick={() =>
                  patchTicket(
                    { assignee: transferTo.trim() },
                    `Transferred to ${transferTo.trim()}.`
                  ).then(() => {
                    setTransferring(false);
                    setTransferTo('');
                  })
                }
              />
            </Spacings.Inline>
          )}

          {notice && <Text.Detail tone="secondary">{notice}</Text.Detail>}
        </Spacings.Stack>
      </Card>

      <InfoModalPage
        title="Select customer"
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
      >
        <CustomerPicker
          onSelect={(c) => {
            setShowPicker(false);
            push(`${appBase}/customers/${c.id}`);
          }}
        />
      </InfoModalPage>
    </div>
  );
};
StatusBar.displayName = 'StatusBar';

export default StatusBar;
