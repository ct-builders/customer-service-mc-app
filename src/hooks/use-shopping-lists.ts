/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  ShoppingList,
  ShoppingListDraft,
  ShoppingListPagedQueryResponse,
  ShoppingListUpdateAction,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp, q } from '../sdk/use-ctp';

/** Shopping lists (gift / wish lists) belonging to a customer. */
export const useCustomerLists = (customerId?: string) => {
  const { get } = useCtp();
  const { data, loading, error, refetch } =
    useAsyncData<ShoppingListPagedQueryResponse>(
      () =>
        get(
          `/shopping-lists?limit=50&expand=lineItems[*].variant&sort=createdAt desc&where=${q(
            `customer(id = "${customerId}")`
          )}`
        ),
      [customerId],
      Boolean(customerId)
    );
  return { results: data?.results ?? [], loading, error, refetch };
};

export const useShoppingListActions = () => {
  const { post } = useCtp();

  const create = useCallback(
    (draft: ShoppingListDraft) => post<ShoppingList>(`/shopping-lists`, draft),
    [post]
  );

  const update = useCallback(
    (
      list: Pick<ShoppingList, 'id' | 'version'>,
      actions: ShoppingListUpdateAction[]
    ) =>
      post<ShoppingList>(`/shopping-lists/${list.id}`, {
        version: list.version,
        actions,
      }),
    [post]
  );

  return { create, update };
};
