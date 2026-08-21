/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import Card from '@commercetools-uikit/card';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import {
  useCustomerLists,
  useShoppingListActions,
} from '../../hooks/use-shopping-lists';
import { useEnsureTicket } from '../../hooks/use-ensure-ticket';
import { useSession } from '../../session/session-context';
import { formatDate, fullName, localized, getErrorMessage } from '../../utils';
import CustomerPicker from '../customer-picker';

const Lists = () => {
  const { currentCustomer } = useSession();
  const {
    results: lists,
    loading,
    error,
    refetch,
  } = useCustomerLists(currentCustomer?.id);
  const { create } = useShoppingListActions();
  const { ensureTicket } = useEnsureTicket();
  const [notice, setNotice] = useState<string>();

  const createList = async () => {
    if (!currentCustomer) return;
    try {
      await create({
        name: { 'en-US': 'Wish list' },
        customer: { typeId: 'customer', id: currentCustomer.id },
      });
      setNotice('Created a new wish list.');
      refetch();
      void ensureTicket('Created a new wish list.');
    } catch (e) {
      setNotice(getErrorMessage(e));
    }
  };

  return (
    <Spacings.Stack scale="l">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">Gift &amp; Wish Lists</Text.Headline>
        <Text.Detail tone="secondary">
          Manage the current customer's shopping lists.
        </Text.Detail>
      </Spacings.Stack>

      {!currentCustomer ? (
        <Card theme="light" type="raised">
          <Spacings.Stack scale="s">
            <Text.Subheadline as="h4">Select a customer</Text.Subheadline>
            <CustomerPicker />
          </Spacings.Stack>
        </Card>
      ) : (
        <Spacings.Stack scale="m">
          <Spacings.Inline
            scale="m"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text.Subheadline as="h4">
              Lists for {fullName(currentCustomer)}
            </Text.Subheadline>
            <SecondaryButton label="New wish list" onClick={createList} />
          </Spacings.Inline>

          {notice && (
            <ContentNotification type="success">
              <Text.Body>{notice}</Text.Body>
            </ContentNotification>
          )}
          {!!error && (
            <ContentNotification type="error">
              <Text.Body>{getErrorMessage(error)}</Text.Body>
            </ContentNotification>
          )}
          {loading && <LoadingSpinner />}

          {!loading && lists.length === 0 && (
            <Text.Detail tone="secondary">
              No lists for this customer.
            </Text.Detail>
          )}

          {lists.map((list) => (
            <Card key={list.id} theme="light" type="raised">
              <Spacings.Stack scale="s">
                <Spacings.Inline
                  scale="s"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Text.Body isBold>{localized(list.name)}</Text.Body>
                  <Text.Detail tone="secondary">
                    {list.lineItems.length} item(s) ·{' '}
                    {formatDate(list.createdAt)}
                  </Text.Detail>
                </Spacings.Inline>
                {list.lineItems.map((li) => (
                  <Text.Detail key={li.id}>
                    {li.quantity} × {localized(li.name)}
                  </Text.Detail>
                ))}
              </Spacings.Stack>
            </Card>
          ))}
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
Lists.displayName = 'Lists';

export default Lists;
