/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type {
  Category,
  CategoryPagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';
import { localized } from '../utils';

export type TCategoryNode = Category & { children: TCategoryNode[] };

/** Fetch all categories and build a parent/child tree sorted by name. */
export const useCategoryTree = () => {
  const { get } = useCtp();
  const { data, loading, error } = useAsyncData<CategoryPagedQueryResponse>(
    () => get(`/categories?limit=500`),
    []
  );

  const all = data?.results ?? [];
  const byId = new Map<string, TCategoryNode>(
    all.map((c) => [c.id, { ...c, children: [] }])
  );
  const roots: TCategoryNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.parent?.id;
    if (parentId && byId.has(parentId)) byId.get(parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortByName = (nodes: TCategoryNode[]) => {
    nodes.sort((a, b) => localized(a.name).localeCompare(localized(b.name)));
    nodes.forEach((n) => sortByName(n.children));
  };
  sortByName(roots);

  return { roots, loading, error };
};
