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
import { useHistory } from 'react-router-dom';
import Card from '@commercetools-uikit/card';
import PrimaryButton from '@commercetools-uikit/primary-button';
import Spacings from '@commercetools-uikit/spacings';
import Stamp from '@commercetools-uikit/stamp';
import Text from '@commercetools-uikit/text';
import { useCustomerBusinessUnits } from '../../hooks/use-customers';
import { useEnsureTicket } from '../../hooks/use-ensure-ticket';
import { useSession } from '../../session/session-context';
import { shopPagePath } from '../../csr-launch';
import { useAppBase } from '../../sdk/use-app-base';
import { fullName } from '../../utils';
import CustomerPicker from '../customer-picker';

/**
 * Place order for customer. The CSR picks a customer, then opens the storefront
 * full-bleed (the /shop page) running in CSR mode — logged in AS the customer,
 * with elevated privileges like cart price overrides. All cart building happens
 * in the storefront — the MC app itself no longer builds carts.
 */
const AssistedOrder = () => {
  const { currentCustomer } = useSession();
  const { isB2B, units } = useCustomerBusinessUnits(currentCustomer?.id);
  const { ensureTicket } = useEnsureTicket();
  const { push } = useHistory();
  const appBase = useAppBase();

  return (
    <Spacings.Stack scale="l">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">Place order for customer</Text.Headline>
        <Text.Detail tone="secondary">
          Open the storefront as this customer to build and place their order —
          with CSR privileges (cart price overrides, discount codes, shipping
          options).
        </Text.Detail>
      </Spacings.Stack>

      <Card theme="light" type="raised">
        <Spacings.Stack scale="m">
          {currentCustomer ? (
            <React.Fragment>
              <Spacings.Inline scale="s" alignItems="center">
                <Text.Body isBold>
                  {fullName(currentCustomer)} ({currentCustomer.email})
                </Text.Body>
                {isB2B && (
                  <Stamp
                    isCondensed
                    tone="primary"
                    label={`B2B: ${units[0]?.name || units[0]?.key}`}
                  />
                )}
              </Spacings.Inline>
              <div>
                <PrimaryButton
                  label={`Place order in ${
                    isB2B ? 'B2B storefront' : 'storefront'
                  } (CSR mode)`}
                  onClick={() => {
                    void ensureTicket(
                      'Opened storefront to place an order (CSR mode).'
                    );
                    push(
                      shopPagePath(appBase, {
                        customerId: currentCustomer.id,
                        label: fullName(currentCustomer),
                        isB2B,
                        businessUnitKey: units[0]?.key,
                      })
                    );
                  }}
                />
              </div>
              <Text.Detail tone="secondary">
                Opens the {isB2B ? 'B2B' : 'B2C'} storefront logged in as this
                customer. A yellow CSR banner marks the elevated session.
              </Text.Detail>
            </React.Fragment>
          ) : (
            <Spacings.Stack scale="s">
              <Text.Subheadline as="h4">
                Select a customer to start
              </Text.Subheadline>
              <CustomerPicker />
            </Spacings.Stack>
          )}
        </Spacings.Stack>
      </Card>
    </Spacings.Stack>
  );
};
AssistedOrder.displayName = 'AssistedOrder';

export default AssistedOrder;
