/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useState } from 'react';
import { useHistory, useRouteMatch, Route, Switch } from 'react-router-dom';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import DataTable from '@commercetools-uikit/data-table';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import type { BusinessUnit } from '@commercetools/platform-sdk';
import { businessRef, useBusinessUnitSearch } from '../../hooks/use-businesses';
import { useSession } from '../../session/session-context';
import { getErrorMessage } from '../../utils';
import AccountScopeToggle from '../account-scope-toggle';
import BusinessDashboard from './business-dashboard';

const columns = [
  { key: 'name', label: 'Business' },
  { key: 'key', label: 'Key' },
  { key: 'contactEmail', label: 'Contact' },
  { key: 'stores', label: 'Stores' },
  { key: 'members', label: 'Members' },
];

const BusinessesList = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  const { selectBusiness } = useSession();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const { results, loading, error } = useBusinessUnitSearch(term);

  const open = (bu: BusinessUnit) => {
    selectBusiness(businessRef(bu));
    push(`${match.url}/${bu.id}`);
  };

  return (
    <Spacings.Stack scale="l">
      <Spacings.Inline scale="m" alignItems="center">
        <Text.Headline as="h2">Businesses</Text.Headline>
        <AccountScopeToggle />
      </Spacings.Inline>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(input);
        }}
      >
        <Spacings.Inline scale="s" alignItems="center">
          <TextInput
            value={input}
            placeholder="Search businesses by name, key or contact email"
            onChange={(e) => setInput(e.target.value)}
          />
          <PrimaryButton label="Search" onClick={() => setTerm(input)} />
          {term && (
            <SecondaryButton
              label="Clear"
              onClick={() => {
                setInput('');
                setTerm('');
              }}
            />
          )}
        </Spacings.Inline>
      </form>

      {!!error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {loading && <LoadingSpinner />}
      {!loading && results.length === 0 && (
        <ContentNotification type="info">
          <Text.Body>No businesses found.</Text.Body>
        </ContentNotification>
      )}

      {results.length > 0 && (
        <DataTable<BusinessUnit>
          columns={columns}
          rows={results}
          onRowClick={(row) => open(row)}
          itemRenderer={(item, column) => {
            switch (column.key) {
              case 'name':
                return item.name;
              case 'key':
                return item.key;
              case 'contactEmail':
                return item.contactEmail ?? '—';
              case 'stores':
                return item.stores?.length ?? 0;
              case 'members':
                return item.associates?.length ?? 0;
              default:
                return null;
            }
          }}
        />
      )}
    </Spacings.Stack>
  );
};
BusinessesList.displayName = 'BusinessesList';

/**
 * Businesses module router. A business-unit id in the URL shows the full-screen
 * Business Dashboard; otherwise the searchable list.
 */
const Businesses = () => {
  const match = useRouteMatch();
  const { push } = useHistory();
  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:id`}>
        <BusinessDashboard onClose={() => push(match.url)} />
      </SuspendedRoute>
      <Route>
        <BusinessesList />
      </Route>
    </Switch>
  );
};
Businesses.displayName = 'Businesses';

export default Businesses;
