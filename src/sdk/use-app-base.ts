/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { entryPointUriPath } from '../constants';

/** Absolute base path of this Custom Application: `/:projectKey/:entryPointUriPath`. */
export const useAppBase = (): string => {
  const projectKey = useApplicationContext<string>(
    (context) => context.project?.key ?? ''
  );
  return `/${projectKey}/${entryPointUriPath}`;
};
