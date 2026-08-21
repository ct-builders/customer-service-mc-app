/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { MC_API_PROXY_TARGETS } from '@commercetools-frontend/constants';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
import type { TSdkAction } from '@commercetools-frontend/sdk';

const target = MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM;

/**
 * Low-level commercetools REST client for the Custom Application.
 *
 * Requests are forwarded through the Merchant Center API gateway
 * (`/proxy/ctp/:projectKey/...`), which authenticates as the logged-in
 * Merchant Center user and enforces that user's permissions. The app never
 * holds commercetools client credentials.
 */
export const useCtp = () => {
  const dispatch = useAsyncDispatch<TSdkAction, unknown>();
  const projectKey = useApplicationContext<string>(
    (context) => context.project?.key ?? ''
  );

  const get = useCallback(
    <T>(path: string): Promise<T> =>
      dispatch(
        actions.get({ mcApiProxyTarget: target, uri: `/${projectKey}${path}` })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  const post = useCallback(
    <T>(path: string, payload: unknown): Promise<T> =>
      dispatch(
        actions.post({
          mcApiProxyTarget: target,
          uri: `/${projectKey}${path}`,
          payload,
        })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  const del = useCallback(
    <T>(path: string): Promise<T> =>
      dispatch(
        actions.del({ mcApiProxyTarget: target, uri: `/${projectKey}${path}` })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  /**
   * POST to a dedicated Merchant Center search proxy target (e.g.
   * `customer-search`, `order-search`). These endpoints are `POST
   * /proxy/<target>/<projectKey>` with a search request body and return
   * IDs + relevance only.
   */
  const search = useCallback(
    <T>(searchTarget: string, payload: unknown): Promise<T> =>
      dispatch(
        actions.post({
          mcApiProxyTarget: searchTarget as typeof target,
          uri: `/${projectKey}`,
          payload,
        })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  return { get, post, del, search, projectKey };
};

/** URL-encode a commercetools query predicate / value for use in a query string. */
export const q = (value: string) => encodeURIComponent(value);
