/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { Switch, Route, useRouteMatch } from 'react-router-dom';
import AssistedOrder from './components/assisted-order';
import Businesses from './components/businesses';
import Customers from './components/customers';
import DomainTabs from './components/domain-tabs';
import Home from './components/home';
import Lists from './components/lists';
import Orders from './components/orders';
import Returns from './components/returns';
import Settings from './components/settings';
import ShopPage from './components/shop/shop-page';
import StatusBar from './components/status-bar';
import Tickets from './components/tickets';
import { usePageTitle } from './sdk/use-page-title';
import { SessionProvider } from './session/session-context';

const ApplicationRoutes = () => {
  const match = useRouteMatch();
  // The browser tab says "Customer Service", not the entry-point slug. Called here
  // so it covers every route in the app, including the full-bleed /shop page.
  usePageTitle();

  return (
    <SessionProvider>
      <Switch>
        {/* Full-bleed storefront page — no status bar, tabs, or gutters, to
            maximize space for the embedded website. */}
        <Route path={`${match.path}/shop`}>
          <ShopPage />
        </Route>
        <Route>
          <StatusBar />
          <DomainTabs />
          <div style={{ padding: '16px 24px 32px' }}>
            <Switch>
              <Route path={`${match.path}/customers`}>
                <Customers />
              </Route>
              <Route path={`${match.path}/businesses`}>
                <Businesses />
              </Route>
              <Route path={`${match.path}/orders`}>
                <Orders />
              </Route>
              <Route path={`${match.path}/returns`}>
                <Returns />
              </Route>
              <Route
                path={[`${match.path}/cart`, `${match.path}/assisted-order`]}
              >
                <AssistedOrder />
              </Route>
              <Route path={`${match.path}/lists`}>
                <Lists />
              </Route>
              <Route path={`${match.path}/tickets`}>
                <Tickets />
              </Route>
              <Route path={`${match.path}/settings`}>
                <Settings />
              </Route>
              <Route>
                <Home />
              </Route>
            </Switch>
          </div>
        </Route>
      </Switch>
    </SessionProvider>
  );
};
ApplicationRoutes.displayName = 'ApplicationRoutes';

export default ApplicationRoutes;
