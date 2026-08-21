/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback, useEffect, useState } from 'react';

type TAsyncData<T> = {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Runs an async fetcher and tracks loading/error/data state, with a `refetch`.
 * `enabled` lets callers defer the request (e.g. until a customer is selected).
 */
export const useAsyncData = <T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  enabled = true
): TAsyncData<T> => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(undefined);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(undefined);
    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (!active) return;
        setError(e);
        // Drop the previous result. Keeping it renders stale data under an error
        // banner as though it were the answer to the current request — which is how
        // a broken customer search read as "it returns every customer no matter
        // what you type": the failed search left the unfiltered list on screen.
        setData(undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  return { data, loading, error, refetch };
};
