/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ProductProjectionPagedSearchResponse } from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';

export const MIN_SEARCH_CHARS = 3;

type Params = { term: string; categoryId?: string };

/**
 * Product lookup for the assisted-order product selector. Full-text search
 * (fuzzy) kicks in at >= 3 characters; category filter uses the subtree so a
 * top-level category also returns products in its child categories.
 */
export const useProductSearch = ({ term, categoryId }: Params) => {
  const { get } = useCtp();
  const trimmed = term.trim();
  const hasText = trimmed.length >= MIN_SEARCH_CHARS;
  const enabled = hasText || Boolean(categoryId);

  const { data, loading, error } =
    useAsyncData<ProductProjectionPagedSearchResponse>(
      () => {
        const params = new URLSearchParams();
        params.set('staged', 'false');
        params.set('limit', '100');
        params.set('markMatchingVariants', 'false');
        if (hasText) {
          params.set('text.en-US', trimmed);
          params.set('fuzzy', 'true');
        }
        if (categoryId) {
          params.append('filter', `categories.id: subtree("${categoryId}")`);
        }
        return get(`/product-projections/search?${params.toString()}`);
      },
      [trimmed, categoryId],
      enabled
    );

  return { results: data?.results ?? [], loading, error, enabled };
};
