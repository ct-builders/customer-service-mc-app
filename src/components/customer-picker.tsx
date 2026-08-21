/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import type { Customer } from '@commercetools/platform-sdk';
import { useCustomerSearch } from '../hooks/use-customers';
import { useSession, type TCustomerRef } from '../session/session-context';
import { fullName } from '../utils';

export const toCustomerRef = (c: Customer | TCustomerRef): TCustomerRef => ({
  id: c.id,
  email: c.email,
  firstName: c.firstName,
  lastName: c.lastName,
});

type Props = {
  /** Called after a customer is chosen (already set as the global current customer). */
  onSelect?: (customer: TCustomerRef) => void;
};

/** Reusable picker: searches customers, and shows recent customers when idle. */
const CustomerPicker = ({ onSelect }: Props) => {
  const { recentCustomers, selectCustomer } = useSession();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const { results, loading } = useCustomerSearch(term);

  const choose = (customer: TCustomerRef) => {
    selectCustomer(customer);
    onSelect?.(customer);
  };

  const rows: TCustomerRef[] = term
    ? results.map(toCustomerRef)
    : recentCustomers;

  return (
    <Spacings.Stack scale="s">
      <style>{`.csr-picker-row:hover{background:#f4f3ff !important;border-color:#6359ff !important;}`}</style>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(input);
        }}
      >
        <Spacings.Inline scale="s" alignItems="center">
          <TextInput
            value={input}
            placeholder="Search customers by email, name or id"
            onChange={(e) => setInput(e.target.value)}
          />
          <PrimaryButton label="Search" onClick={() => setTerm(input)} />
          {term && (
            <SecondaryButton
              label="Recent"
              onClick={() => {
                setTerm('');
                setInput('');
              }}
            />
          )}
        </Spacings.Inline>
      </form>

      {loading && <LoadingSpinner scale="s" />}

      {!term && recentCustomers.length === 0 && (
        <Text.Detail tone="secondary">
          No recent customers yet — search to find one.
        </Text.Detail>
      )}
      {term && !loading && rows.length === 0 && (
        <Text.Detail tone="secondary">No customers found.</Text.Detail>
      )}

      {!term && rows.length > 0 && (
        <Text.Detail tone="secondary">Recent customers</Text.Detail>
      )}
      {rows.slice(0, 8).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => choose(c)}
          className="csr-picker-row"
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            background: '#fff',
            border: '1px solid #e3e3e3',
            borderRadius: 6,
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <Text.Body>
            {fullName(c)} · {c.email}
          </Text.Body>
          <Text.Detail tone="primary">Select →</Text.Detail>
        </button>
      ))}
    </Spacings.Stack>
  );
};
CustomerPicker.displayName = 'CustomerPicker';

export default CustomerPicker;
